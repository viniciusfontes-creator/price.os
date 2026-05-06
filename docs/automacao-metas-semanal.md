# Automação Semanal de Metas — Resumo Executivo

## O Problema

Hoje, quando uma propriedade entra em operação sem passar pelo fluxo completo de onboarding no Jestor, ou quando chega o fim do ano e o ciclo de metas do próximo ano ainda não foi projetado, ficam **lacunas de meta** em `stage.metas_checkout_mensais_unidade`. Isso gera:

- Unidades com reservas reais aparecendo como **status E (sem meta)** no Dashboard e no Hub de Inteligência.
- Rankings e alertas poluídos.
- Necessidade de ação manual toda semana.

## A Solução

Criamos **2 workflows n8n** que, juntos, automatizam 100% da criação de metas faltantes:

### Workflow 1 — Job Semanal (Agendado)

Roda **toda Segunda às 06:00**:

1. **Detecta o lote**: query BigQuery que cruza 3 tabelas e retorna propriedades que:
   - Estão **ativas** (`status_aparente = 'Ativa'`, `empreendimento_pousada = 'Short Stay'`);
   - Tiveram **reserva criada nos últimos 90 dias** (filtro em `warehouse.reservas_all`, ignorando canceladas);
   - Estão com **meta faltando em ao menos um dos próximos 12 meses** (LEFT JOIN em `stage.metas_checkout_mensais_unidade` onde não existe registro).
2. Para cada propriedade detectada, dispara o Sub-workflow 2 passando a lista exata de meses faltantes (ex: `["05/2026", "09/2026"]`).
3. Processa em **lotes de 3 propriedades** com pausa de 10s entre batches (para não sobrecarregar Gemini/Supabase).
4. Ao final, envia **resumo no Slack**: "X propriedades processadas, Y metas inseridas, Z falhas".

### Workflow 2 — Sub-workflow de Cálculo (Reutilizável)

É o mesmo cálculo que já usamos no onboarding via Jestor, **extraído em um componente reutilizável**:

1. Busca **imóveis similares num raio de 5 km** no Supabase.
2. **Gemini** estima `propertyValue` (com desconto de 10–20%) e `propertyAppreciation` da vizinhança.
3. Meta anual = `valor do imóvel × 14%`.
4. **Distribui a meta pelos 12 meses** usando o histórico real da praça, com:
   - Correção automática do **Carnaval** (quando Março historicamente teve mais que Fevereiro);
   - Garantia de **mínimo de 5%** por mês;
   - **Pacotes de feriado** (Reveillon, Carnaval, Semana Santa, etc.).
5. **Filtro anti-duplicação**: só insere os meses que vieram na lista `meses_faltantes` — nunca sobrescreve meta existente.
6. Insere em `stage.metas_checkout_mensais_unidade` e retorna `{ metas_inseridas, meses }` para o job semanal agregar.

## Ganhos

| Antes | Depois |
|---|---|
| Metas só criadas via onboarding manual (Jestor) | Cobertura automática semanal de qualquer lacuna |
| Sem visibilidade das unidades sem meta | Slack semanal com unidades + quantidade de metas inseridas |
| Lógica duplicada se quiséssemos outro gatilho | Cálculo centralizado em sub-workflow, reutilizável |
| Risco de duplicar meta ao re-rodar | 3 camadas de proteção (query + filtro + idempotência) |

## Proteções Contra Duplicação

1. **Na detecção**: a query só retorna pares `(propriedade, mês)` que **não existem** na tabela de metas.
2. **No cálculo**: o sub-workflow filtra a saída para manter apenas os meses passados como "faltantes".
3. **Reexecução segura**: rodar o job 2x no mesmo dia não cria duplicatas — a segunda execução simplesmente não encontra gaps.

## Próximos Passos

1. Importar os 2 JSONs no n8n.
2. Amarrar o ID do sub-workflow no node `Execute Workflow` do job semanal.
3. Apontar credencial do Slack e criar canal `#metas-automacao`.
4. **Dry-run manual** com Schedule desligado para validar 1 propriedade real com gap conhecido.
5. **Ativar o Schedule** na próxima Segunda.

## Custo Operacional

- **Gemini**: ~1 chamada por propriedade com gap. Propriedades sem gap não custam nada.
- **BigQuery**: 1 query principal + N inserts. Processamento dentro do free tier esperado.
- **Tempo de execução**: ~15s por propriedade, ~5 min para um lote típico de 10 unidades.

## Arquivos Relacionados

- [n8n-metas-semanal-workflow.json](n8n-metas-semanal-workflow.json) — Workflow 1 (Schedule + detecção)
- [n8n-metas-unidade-subworkflow.json](n8n-metas-unidade-subworkflow.json) — Workflow 2 (sub-workflow de cálculo)
- [BIGQUERY_ARCHITECTURE.md](BIGQUERY_ARCHITECTURE.md) — Schema das tabelas envolvidas
