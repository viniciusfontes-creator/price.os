-- 013_pricing_ajustes_stays_sync.sql
-- Liga a aprovação individual em /sugestoes-estagiario/precificacao à Stays API.
--
-- Antes desta migration: ao aprovar uma proposta em pricing_ajustes_propostos,
-- só mudávamos o status no Supabase e disparávamos o webhook N8N (que não
-- escreve na Stays). O preço no PMS ficava o antigo até alguém editar à mão.
--
-- Depois desta migration: o endpoint PATCH /api/pricing/ajustes/[id] chama
-- applyPricingAjusteToStays() antes do webhook N8N, populando os campos
-- stays_sync_* abaixo. Espelha o padrão de property_onboarding (migration 012).
--
-- O mapping idpropriedade ↔ stays_listing_id e (listing_id, period_id) ↔
-- season_id vive em tabelas próprias (caches), porque:
--   - não existe tabela `propriedades` no Supabase (a verdade está no BQ);
--   - cada period_id mapeia para 1 season POR LISTING (não global).

-- ============================================================================
-- 1. pricing_ajustes_propostos ganha as colunas de sync com a Stays
-- ============================================================================

alter table public.pricing_ajustes_propostos
  -- Status da sincronização com a Stays:
  -- null      → aprovação ainda não rodou (estado inicial)
  -- 'synced'  → PATCH real na Stays bem-sucedido
  -- 'dry_run' → simulado, nada enviado (modo dev/staging)
  -- 'unmapped'→ faltou stays_listing_id ou stays_season_id (ver errors)
  -- 'error'   → PATCH falhou (ver errors)
  add column if not exists stays_sync_status text,
  add column if not exists stays_synced_at timestamptz,

  -- Detalhe de erros por sync. Para aprovação individual (1 season), tem
  -- shape: { items: [{ seasonId, status, message, needsMonthlyRate }] } ou
  -- { reason: 'unmapped_listing'|'unmapped_season', detail: '...' }
  add column if not exists stays_sync_errors jsonb;

create index if not exists pricing_ajustes_propostos_stays_sync_status_idx
  on public.pricing_ajustes_propostos (stays_sync_status, stays_synced_at desc)
  where stays_sync_status is not null;

comment on column public.pricing_ajustes_propostos.stays_sync_status is
  'Status da sincronização com a Stays após aprovação. null=não rodou; synced/dry_run/unmapped/error.';
comment on column public.pricing_ajustes_propostos.stays_sync_errors is
  'Detalhes de falhas da sincronização. Shape varia por motivo.';

-- ============================================================================
-- 2. stays_property_map — cache de idpropriedade → stays_listing_id
-- ============================================================================
-- Resolução em ordem:
--   1. SELECT desta tabela
--   2. SELECT property_onboarding.stays_listing_id (mais recente) e cacheia aqui
--   3. GET /external/v1/content/listings?l.id={idpropriedade}, cacheia aqui

create table if not exists public.stays_property_map (
  idpropriedade     text primary key,
  stays_listing_id  text not null,
  -- 'onboarding' → veio de property_onboarding
  -- 'api'        → resolvido via GET /content/listings
  -- 'manual'     → preenchido manualmente (admin)
  source            text not null default 'api',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists stays_property_map_listing_idx
  on public.stays_property_map (stays_listing_id);

alter table public.stays_property_map enable row level security;

comment on table public.stays_property_map is
  'Cache local de idpropriedade → stays_listing_id (_id Mongo). Preenchido sob demanda quando o operador aprova um ajuste; reutilizado em chamadas futuras.';

-- ============================================================================
-- 3. stays_season_map — cache de (listing_id, period_id) → season_id
-- ============================================================================
-- A Stays materializa 1 season por (listing × período da region). Logo, o
-- mesmo pricing_period.id pode bater com seasonIds diferentes em listings
-- diferentes — o cache precisa ser composto.

create table if not exists public.stays_season_map (
  stays_listing_id  text not null,
  period_id         uuid not null references public.pricing_periods (id) on delete cascade,
  stays_season_id   text not null,
  -- snapshot das datas no momento da resolução (debug)
  season_from       date,
  season_to         date,
  -- 'auto' → resolvido via listListingSeasons() pelo range do period
  -- 'manual' → preenchido por admin
  source            text not null default 'auto',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (stays_listing_id, period_id)
);

create index if not exists stays_season_map_season_idx
  on public.stays_season_map (stays_season_id);

alter table public.stays_season_map enable row level security;

comment on table public.stays_season_map is
  'Cache local de (stays_listing_id, period_id) → stays_season_id. Cada pricing_period vira N seasons distintas na Stays (uma por listing). Preenchido sob demanda.';
