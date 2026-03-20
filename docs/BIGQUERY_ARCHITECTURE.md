# BigQuery Data Architecture - Price.OS

Esta documentação detalha como os dados estão estruturados no BigQuery da Price.OS, as tabelas fundamentais, os formatos de dados e os padrões de consulta recomendados para a aplicação.

## 🏗️ Visão Geral

A arquitetura de dados é dividida principalmente em dois conjuntos (datasets):

- **`warehouse`**: Contém dados consolidados e processados (Propriedades e Reservas).
- **`stage`**: Contém dados de suporte, metas e informações dinâmicas de calendário/disponibilidade.

---

## 1. Propriedades (O Core)

A tabela mestre que define todas as unidades ativas na operação.

- **Tabela:** `` `warehouse.propriedades_subgrupos` ``
- **Nuância:** Filtramos sempre por `status_aparente = 'Ativa'` para evitar dados de unidades desativadas.

### Principais Colunas de Propriedades

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `idpropriedade` | STRING | ID único da unidade (chave primária). |
| `nomepropriedade` | STRING | Nome interno da unidade. |
| `praca` | STRING | Região geográfica (Ex: São Paulo, Rio). |
| `grupo_nome` | STRING | Agrupamento de unidades (parceiro ou investidor). |
| `baserate_atual` | NUMERIC | Preço base configurado (frequentemente unido via JOIN com `stage.stays_calendar_listing`). |

### SQL Recomendado de Propriedades

```sql
SELECT 
  idpropriedade, nomepropriedade, praca, grupo_nome, sub_grupo
FROM `warehouse.propriedades_subgrupos`
WHERE status_aparente = 'Ativa'
```

---

## 2. Reservas (Performance e Vendas)

Contém o histórico transacional. É a tabela mais pesada e granular.

- **Tabela:** `` `warehouse.reservas_all` ``
- **Nuância:** As datas nesta tabela frequentemente vêm como STRING no formato `DD-MM-YYYY`. É necessário usar `PARSE_DATE` para cálculos.

### Principais Colunas de Reservas

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `reservetotal` | NUMERIC | Valor bruto da reserva (Revenue). |
| `creationdate` | DATE/STRING | Data em que a venda foi feita. |
| `checkindate` | DATE/STRING | Data de entrada do hóspede. |
| `checkoutdate` | DATE/STRING | Data de saída (usada para metas de faturamento). |
| `partnername` | STRING | Canal de venda (Airbnb, Booking, etc). |

### SQL Recomendado de Reservas

```sql
SELECT 
  idpropriedade,
  SAFE_CAST(reservetotal AS NUMERIC) as receita,
  PARSE_DATE('%d-%m-%Y', creationdate) as data_venda,
  CASE 
    WHEN LOWER(partnername) LIKE '%curta%' THEN 'CurtaBora'
    ELSE partnername 
  END as canal
FROM `warehouse.reservas_all`
WHERE LOWER(type) NOT LIKE '%canceled%' AND buyprice > 0
```

---

## 3. Disponibilidade e Ocupação (O Calendário)

Diferente das reservas (vendas passadas/futuras), esta tabela rastreia o estado físico da unidade em cada data do calendário.

- **Tabela:** `` `stage.ocupacaoDisponibilidade_teste1` ``
- **Nuância:** Esta tabela é a fonte da verdade para o que está livre, bloqueado ou em manutenção.

### Principais Colunas de Ocupação

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `idpropriedade` | STRING | ID da unidade. |
| `datas` | DATE | A data específica no calendário. |
| `disponivel` | INT64 | Flag (0 ou 1) indicando se a unidade pode ser vendida. |
| `ocupado` | INT64 | Flag indicando se há uma reserva ativa (hóspede). |
| `ocupado_proprietario` | INT64 | Flag indicando bloqueio por uso do dono. |
| `manutencao` | INT64 | Flag indicando bloqueio técnico/manutenção. |

### SQL Recomendado de Ocupação

```sql
SELECT
  idPropriedade,
  datas,
  ocupado,
  manutencao,
  disponivel
FROM `stage.ocupacaoDisponibilidade_teste1`
WHERE DATE(datas) BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 90 DAY)
```

---

## 4. Preços e Descontos

Dados dinâmicos que mudam diariamente conforme o mercado.

- **Tabela de Preços:** `` `stage.stays_calendar_listing` ``
- **Tabela de Descontos/Acréscimos:** `` `stage.stays_discounts_calendar` ``

### Nuâncias de Desconto (`stays_discounts_calendar`)

- **`discount_percent`**: Valor numérico do ajuste.
- **`is_rise`**: Flag crucial. Se `1`, o valor é um **acréscimo** (Markup). Se `0`, é um **desconto** (Markdown).

---

## 5. Metas (Estratégico)

Define os objetivos financeiros por unidade e mês.

- **Tabela:** `` `stage.metas_checkout_mensais_unidade` ``
- **Nuância:** As metas são baseadas no **mês de checkout**. O campo `mes_ano` vem no formato `MM/YYYY`.

### Principais Colunas de Metas

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `idpropriedade` | STRING | ID da unidade. |
| `mes_ano` | STRING | Referência temporal (Ex: '03/2026'). |
| `meta` | NUMERIC | Valor alvo de faturamento. |

---

## 💡 Dicas de Performance e Boas Práticas

1. **Casting Seguro**: Sempre use `SAFE_CAST(coluna AS FLOAT64/NUMERIC)` para evitar erros de query quando houver sujeira nos dados (campos vazios ou strings inesperadas).
2. **Filtro de Cancelamento**: Para Dashboards de Receita, sempre filtre `LOWER(type) NOT LIKE '%canceled%'` na tabela de reservas.
3. **Padronização de Canais**: O `partnername` possui variações (ex: "Atendimento", "Atendimento Host"). Use um `CASE WHEN` para agrupar canais semelhantes e facilitar a leitura.
4. **Janela Temporal**: Ao buscar reservas, limite a busca (ex: últimos 90 dias) para economizar processamento no BigQuery, a menos que precise de um histórico completo.

---

## 🔍 Como testar novas estruturas?

Para validar se uma coluna nova existe ou ver o formato real dos dados:

```sql
-- Verificar os primeiros 10 registros de qualquer tabela
SELECT * FROM `dataset.tabela` LIMIT 10
```
