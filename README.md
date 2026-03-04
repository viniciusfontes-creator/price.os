# Qavi Dashboard

Sistema de gestao hoteleira para acompanhamento de propriedades de aluguel por temporada, com dados integrados do BigQuery, monitoramento de concorrentes via Supabase e assistente IA com Google Gemini.

## Stack

- **Frontend**: Next.js 14 + React 19 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui
- **Dados**: Google BigQuery (producao) + Supabase (concorrentes)
- **IA**: Google Gemini 1.5 Flash (chat streaming)
- **Deploy**: Netlify

## Quick Start

```bash
# Instalar dependencias
npm install

# Configurar variaveis de ambiente
cp .env.local.example .env.local
# Preencha os valores em .env.local

# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Estrutura

```
app/                    # Paginas e API routes (Next.js App Router)
  page.tsx              # Dashboard principal (BigQuery)
  vendas/               # Pagina de vendas (BigQuery)
  pricing/              # Inteligencia de precos (BigQuery)
  sales-demand/         # Demanda de vendas (BigQuery)
  concorrencia/         # Monitor de concorrentes (Supabase)
  api/                  # 15 API routes (dashboard, gemini, baskets, places, etc.)
components/             # Componentes React (filtros, graficos, rankings, market-monitor)
contexts/               # GlobalFiltersContext + DashboardProvider (SWR)
lib/                    # Servicos e utilitarios
  bigquery-service.ts   # Queries e transformacao de dados BigQuery
  bigquery-client.ts    # Cliente BigQuery
  calculations.ts       # Logica de calculo de metricas e status
  filter-utils.ts       # Aplicacao de filtros globais
  supabase-client.ts    # Cliente Supabase
types/index.ts          # Tipos TypeScript centralizados
docs/                   # Documentacao detalhada
```

## Variaveis de Ambiente

Veja [.env.local.example](.env.local.example) para todas as variaveis necessarias:

- `GCP_PROJECT_ID`, `GCP_CLIENT_EMAIL`, `GCP_PRIVATE_KEY` - Google BigQuery
- `GEMINI_API_KEY` - Google Gemini AI
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase
- `GOOGLE_PLACES_API_KEY` - Google Places (server-side)

## Documentacao

Documentacao detalhada em [docs/](./docs/):

- [Arquitetura](./docs/ARCHITECTURE.md) - Design do sistema
- [API](./docs/API_SPEC.md) - Especificacao das API routes
- [Funcionalidades](./docs/FEATURES.md) - Modulos e roadmap
- [Guia do Usuario](./docs/USER_GUIDE.md) - Como usar os filtros
- [Camada de Dados](./docs/DATA_LAYER.md) - Referencia tecnica

## Build

```bash
npm run build
npm run start
```

---

**Versao**: 1.1.0 | **Deploy**: Netlify | **Dados**: BigQuery + Supabase
