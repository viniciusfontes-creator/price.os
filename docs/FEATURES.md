# FEATURES.md - Funcionalidades e Backlog do Produto

## 📋 Índice

1. [Funcionalidades Implementadas](#funcionalidades-implementadas)
2. [Regras de Negócio](#regras-de-negócio)
3. [Backlog de Inovação (Product Owner)](#backlog-de-inovação)
4. [Roadmap Técnico](#roadmap-técnico)

---

## 🎯 Funcionalidades Implementadas

### 1. **Dashboard Central** (`/app/page.tsx`)

#### Descrição

Painel principal com visão consolidada de performance, vendas e métricas-chave da operação hoteleira.

#### Componentes

- **KeyMetricsPanel**: Exibe KPIs principais
  - Taxa de Ocupação (%)
  - ADR - Average Daily Rate (R$/diária)
  - RevPAR - Revenue Per Available Room
  - Receita Total do Período
  - Diárias Vendidas
  - Ticket Médio por Reserva
  
- **WebhookSyncPanel**: Status de sincronização de dados
  - Última sincronização
  - Total de propriedades, reservas e metas carregadas
  - Botão de atualização manual

- **DailySalesRanking**: Ranking de vendas diárias
  - Top 10 dias com maior volume de vendas
  - Gráfico de barras com receita por dia
  - Número de reservas por dia

- **PartnernameSalesRanking**: Ranking por canal de venda
  - Receita total por parceiro (Booking, Airbnb, etc.)
  - Quantidade de reservas
  - Ticket médio por canal
  - Percentual de participação

- **AnalyticsCharts**: Gráficos de tendências
  - Receita vs Meta Mensal
  - Performance por Grupo (Luxury, Premium, etc.)
  - Evolução temporal de vendas

- **GeminiChat**: Co-piloto de IA conversacional
  - Interface de chat flutuante
  - Perguntas em linguagem natural
  - Respostas contextualizadas com dados do sistema

#### Filtros Globais

- **Grupo**: Luxury, Premium, Standard, Economy
- **Praça**: Ponta Negra, Pipa, Cotovelo, etc.
- **Parceiro**: Booking.com, Airbnb, Expedia, Direto
- **Status**: A, B, C, D, E (baseado em atingimento de meta)
- **Receita**: Range mínimo e máximo
- **Período**: Data inicial e final

---

### 2. **Command Center** (`/app/command-center`)

#### Descrição

Central de comando com visão executiva e alertas inteligentes.

#### Funcionalidades-Chave

- **Alertas de Risco**: Propriedades sem vendas nos últimos 7 dias
- **Oportunidades**: Propriedades com excesso de vendas (potencial para aumentar preço)
- **Performance por Agente**: Ranking de corretores/agentes
- **Meta vs Realizado**: Acompanhamento de atingimento de metas

---

### 3. **Gestão de Inventário** (`/app/inventory`)

#### a) **Visão Geral** (`/app/inventory/page.tsx`)

- Tabela integrada com todas as propriedades
- Filtros avançados por múltiplos critérios
- Indicadores de status (A-E)
- Métricas individuais por propriedade

#### b) **Detecção de Anomalias** (`/app/inventory/abnormal`)

- Identificação automática de padrões anormais:
  - Propriedades sem reservas futuras (próximos 30 dias)
  - Oscilações bruscas de preço
  - Quedas súbitas de ocupação
- Recomendações de ação corretiva

#### c) **Disponibilidade** (`/app/inventory/availability`)

- Calendário visual de ocupação
- Próximos 90 dias de disponibilidade
- Identificação de períodos de baixa ocupação
- Comparação com sazonalidade histórica

---

### 4. **Precificação Dinâmica** (`/app/pricing`)

#### Descrição

Ferramenta para análise e ajuste de tarifas com base em demanda e concorrência.

#### Funcionalidades

- **Tarifário Atual**: Visualização de preços base por propriedade
- **Análise de Elasticidade**: Relação preço x volume de vendas
- **Comparação Competitiva**: Benchmark com Airbnb extrações
- **Sugestões de Ajuste**: Algoritmo sugere aumentos/reduções baseados em:
  - Taxa de ocupação atual
  - Antecedência média de reservas
  - Performance histórica do período

#### Regras de Precificação

```
SE taxa_ocupacao > 80% E antecedencia_media < 15 dias:
  SUGERIR aumento de 10-15%
  
SE taxa_ocupacao < 40% E periodo_até_checkin < 7 dias:
  SUGERIR redução de 10-20%
  
SE vendas_semana > 2 reservas:
  SUGERIR aumento gradual de 5%
```

---

### 5. **Análise de Receita** (`/app/revenue`)

#### Descrição

Dashboards detalhados de performance financeira.

#### Módulos

- **Receita por Canal**: Breakdown de receita por parceiro
- **Receita por Grupo**: Comparação entre segmentos (Luxury vs Premium)
- **Receita por Praça**: Performance geográfica
- **Comissões**: Análise de `companyCommission` vs `buyPrice`
- **Projeções**: Forecast de receita com base em reservas futuras

#### Métricas Calculadas

- **Receita Bruta**: `SUM(reservetotal)`
- **Receita Líquida**: `SUM(buyPrice)`
- **Margem Média**: `AVG(companyCommission / reservetotal) * 100`
- **RevPAR**: `receita_total / (propriedades * dias_no_mes)`

---

### 6. **Vendas e Demanda** (`/app/sales-demand`)

#### Descrição

Análise de pipeline de vendas e padrões de demanda.

#### Funcionalidades

- **Funil de Vendas**: Status das reservas (confirmed, pending, canceled)
- **Antecedência Média**: Tempo entre criação e check-in
- **Sazonalidade**: Análise de períodos de alta/baixa demanda
- **Forecast de Ocupação**: Próximos 30/60/90 dias

#### KPIs de Demanda

- **Lead Time Médio**: Média de `antecedencia_reserva`
- **Conversão**: % de cotações que viram reservas (se integrado)
- **Diárias Médias por Reserva**: `AVG(nightcount)`

---

### 7. **Inteligência de Mercado** (`/app/inteligencia`)

#### Descrição

Análise competitiva e tendências de mercado.

#### Fontes de Dados

- **Airbnb Extrações**: `mockAirbnbExtracoes`
  - Preços de concorrentes
  - Avaliações médias
  - Tipos de propriedade mais procurados
  
- **Google Trends** (simulado): `mockGoogleTrends`
  - Interesse de busca por região
  - Termos relacionados a hospedagem
  - Sazonalidade de busca

- **Cotações** (Supabase simulated): `mockCotacoes`
  - Taxa de conversão por origem
  - Valor médio de cotações

#### Análises Disponíveis

- Comparativo de preço médio (próprio vs mercado)
- Índice de competitividade (% de preço vs concorrência)
- Tendências de busca correlacionadas com vendas

---

### 8. **Detalhes de Unidade** (`/app/unidade/[id]`)

#### Descrição

Visão 360º de uma propriedade específica.

#### Informações Exibidas

- **Dados Cadastrais**: Nome, praça, grupo, subgrupo
- **Métricas de Performance**:
  - Receita total (histórico + futuro)
  - Taxa de ocupação mensal
  - Ticket médio
  - ADR e RevPAR
  
- **Histórico de Vendas**: Tabela de todas as reservas
- **Calendário de Ocupação**: Próximos 90 dias
- **Gráfico de Metas**: Realizado vs Meta Mensal
- **Avaliações**: Reviews por canal (`mockReviews`)

---

### 9. **Co-piloto Gemini AI** (`GeminiChat` component)

#### Descrição

Interface conversacional para análise de dados em linguagem natural.

#### Capacidades

- **Perguntas Complexas**:
  - "Qual foi a receita total de janeiro comparada com dezembro?"
  - "Liste as 5 propriedades com menor ocupação este mês"
  - "Qual canal de vendas teve melhor performance na última semana?"
  
- **Contextualização Automática**:
  - Injeta resumo de dados do sistema no contexto
  - Total de reservas, receita, agentes e canais
  
- **Streaming de Respostas**:
  - Exibição incremental para melhor UX
  - Chunks decodificados em tempo real

#### Limitações Atuais

- Não acessa dados em tempo real (contexto estático por sessão)
- Sem memória de conversas anteriores (stateless)
- API quota dependente da chave configurada

---

## ⚖️ Regras de Negócio

### 1. **Sistema de Status (A-E)**

Classificação de propriedades baseada em atingimento de metas:

| Status | Critério | Significado | Ação Recomendada |
|--------|----------|-------------|------------------|
| **A** | ≥ 100% da meta mensal | Excelente performance | Manter estratégia, considerar aumento de preço |
| **B** | ≥ 90% da meta móvel | Boa performance | Monitorar de perto, pode atingir meta |
| **C** | ≥ 50% da meta móvel | Performance mediana | Ações de ajuste necessárias (preço ou promoção) |
| **D** | < 50% da meta móvel | Performance ruim | Intervenção urgente (revisão de preço/fotos) |
| **E** | Sem receita no mês | Sem vendas | Investigar bloqueios ou problemas técnicos |

**Implementação**: `lib/calculations.ts` → `calculatePropertyStatus()`

---

### 2. **Cálculo de Receita Mensal**

```
receita_checkout_mes = SUM(reservetotal) 
  WHERE checkoutdate >= inicio_mes 
    AND checkoutdate <= fim_mes
    AND type != 'canceled'
```

**Rationale**: Receita é reconhecida no `checkoutdate` (momento do check-out), não na criação da reserva.

---

### 3. **Meta Móvel vs Meta Mensal**

- **Meta Mensal**: Objetivo fixo definido no início do mês
- **Meta Móvel**: 85% da meta mensal (mais conservadora)

**Uso**:

- Status B e C são baseados na meta móvel
- Status A é baseado na meta mensal
- Permite classificação gradual de performance

---

### 4. **Exclusão de Reservas Canceladas**

Todos os cálculos **DEVEM excluir** reservas com `type = 'canceled'`.

**Implementação**: Filtro aplicado em `generateMockReservas()` (linha 134):

```typescript
if (type === 'canceled') continue
```

---

### 5. **Sazonalidade**

Aplicada na geração de metas (`lib/mock-data.ts`, linha 189):

| Período | Fator Sazonal | Meses |
|---------|---------------|-------|
| Alta Temporada | 1.3x | Nov, Dez, Jan, Fev |
| Baixa Temporada | 0.8x | Jun, Jul, Ago |
| Temporada Normal | 1.0x | Demais meses |

---

## 🚀 Backlog de Inovação (Product Owner)

### 🌟 **3 Funcionalidades "Game-Changer"**

#### 1. **Dynamic Pricing Automático com Machine Learning**

**Problema**: Atualmente, os gestores ajustam preços manualmente com base em intuição e dados fragmentados.

**Solução**: Algoritmo de ML que ajusta preços dinamicamente usando:

- **Inputs**:
  - Taxa de ocupação atual e futura (30 dias)
  - Antecedência média de reservas
  - Preços da concorrência (Airbnb extrações)
  - Google Trends (interesse de busca)
  - Eventos locais (calendário de feriados)
  - Histórico de elasticidade (relação preço x demanda)

- **Output**:
  - Sugestão de preço base otimizada
  - Preços diferenciados por período (weekday vs weekend)
  - Confidence score da recomendação

**Impacto Esperado**:

- **+15-25% de receita** sem aumento de ocupação
- **Redução de 80%** do tempo gasto em ajustes manuais
- **ROI**: 3-6 meses

**Esforço**: 4-6 semanas (MVP com modelo de regressão)

**Stack Sugerida**:

- Python (scikit-learn ou TensorFlow)
- Treinamento com dados históricos de 12+ meses
- API endpoint para integração com Next.js

---

#### 2. **Alertas Preditivos e Automação de Ações**

**Problema**: Gestores só identificam problemas quando já impactaram a receita (reativo).

**Solução**: Sistema de alertas inteligentes com ações automatizadas:

**Alertas Implementados**:

| Trigger | Alerta | Ação Automática Sugerida |
|---------|--------|--------------------------|
| Taxa ocupação < 40% em T-7 dias | 🔴 Baixa ocupação iminente | Criar promoção relâmpago (15% off) |
| Sem vendas há 14+ dias | ⚠️ Propriedade estagnada | Revisar fotos/descrição, reduzir 20% preço |
| Vendas > meta em 15 dias | 🟢 Ótima performance | Aumentar 10% preço futuro |
| Concorrente reduziu 20%+ | 📊 Alerta competitivo | Análise de elasticidade, possível ajuste |

**Canais de Notificação**:

- Push notifications no dashboard
- Email digest diário (resumo executivo)
- WhatsApp Business API (alertas críticos)
- Integração Slack/Teams

**Impacto Esperado**:

- **Redução de 60%** em oportunidades perdidas
- **Tempo de resposta 10x mais rápido**
- **Melhoria de 12-18%** no atingimento de metas

**Esforço**: 3-4 semanas

---

#### 3. **Gemini Multimodal: Análise de Fotos e Descrições**

**Problema**: Propriedades com fotos de baixa qualidade ou descrições ruins têm menor taxa de conversão, mas isso é difícil de quantificar.

**Solução**: Usar Gemini Vision API para análise automatizada de fotos das propriedades:

**Funcionalidades**:

- **Score de Qualidade Visual** (0-100):
  - Iluminação adequada
  - Composição profissional
  - Espaço organizado
  - Cores atrativas

- **Análise de Descrição** (Gemini Text):
  - Clareza da comunicação
  - Destaque de diferenciais
  - Palavras-chave SEO
  - Tom de voz adequado ao público

- **Benchmark Competitivo**:
  - Comparação com top performers do Airbnb
  - Sugestões de melhoria específicas
  
**Output**:

```
🏆 Pontuação Global: 72/100

📸 Fotos:
- ✅ Iluminação natural excelente (92/100)
- ⚠️ Falta foto da cozinha equipada
- ❌ Foto da sala está desfocada

📝 Descrição:
- ✅ Destaca vista para o mar
- ⚠️ Faltam informações sobre WiFi
- 💡 Sugestão: Adicionar "perto de restaurantes"
```

**Impacto Esperado**:

- **+8-12% na conversão** de visualizações → reservas
- **Democratização** de boas práticas (pequenos proprietários)
- **Diferencial competitivo** vs OTAs tradicionais

**Esforço**: 2-3 semanas (Gemini Vision já disponível)

---

### 📦 Backlog Secundário (Prioridade Média-Baixa)

#### 4. **Integração com WhatsApp Business**

- Enviar relatórios de performance via WhatsApp
- Chatbot para consultas rápidas ("Qual ocupação hoje?")
- **Esforço**: 1-2 semanas

#### 5. **Módulo de Forecast Avançado**

- Projeção de receita com intervalos de confiança
- Cenários otimista/pessimista/realista
- **Esforço**: 2-3 semanas

#### 6. **Dashboard Mobile (PWA)**

- Versão otimizada para mobile
- Offline-first com service workers
- **Esforço**: 3-4 semanas

#### 7. **A/B Testing de Preços**

- Testar elasticidade com experimentos controlados
- Análise estatística de significância
- **Esforço**: 2-3 semanas

#### 8. **Integração com Google Analytics**

- Rastreamento de eventos em páginas OTA
- Funil de conversão detalhado
- **Esforço**: 1 semana

---

## 🗓️ Roadmap Técnico

### Q1 2026 (Jan-Mar) - **Foundation Phase**

- ✅ Desenvolvimento inicial com mock data
- ✅ Implementação de componentes base
- ✅ Integração Gemini chat
- 🔄 Testes de usabilidade com 5 usuários piloto
- 🔄 Implementação de Error Boundaries
- 📅 Planejado: Testes automatizados (Jest + RTL)

### Q2 2026 (Abr-Jun) - **Data Integration Phase**

- 📅 Integração com BigQuery warehouse
- 📅 Implementação de real-time webhooks
- 📅 Cache distribuído (Redis)
- 📅 **Game-Changer #2**: Sistema de alertas preditivos

### Q3 2026 (Jul-Set) - **Intelligence Phase**

- 📅 **Game-Changer #1**: Dynamic Pricing com ML
- 📅 Dashboard mobile (PWA)
- 📅 Integração WhatsApp Business

### Q4 2026 (Out-Dez) - **Optimization Phase**

- 📅 **Game-Changer #3**: Gemini Multimodal (fotos)
- 📅 A/B Testing framework
- 📅 Módulo de forecast avançado

---

## 📊 Métricas de Sucesso do Produto

### North Star Metric

**Receita Total Gerenciada pelo Sistema** (GMV - Gross Merchandise Value)

### KPIs de Adoção

- **DAU** (Daily Active Users): meta 70% dos gestores
- **Frequência de uso**: média de 3+ acessos/dia
- **Tempo médio por sessão**: 8-12 minutos
- **Consultas Gemini**: 5+ perguntas/semana por usuário

### KPIs de Impacto

- **Aumento de receita**: +12% vs período anterior
- **Melhoria no atingimento de metas**: +18%
- **Redução de propriedades status D/E**: -25%
- **Tempo de ajuste de preços**: -60%

---

**Documento curado por:** Gemini AI - Product Owner & Innovation Architect  
**Data:** 28 de Janeiro de 2026  
**Versão:** 1.0
