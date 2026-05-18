-- 012_property_onboarding_pricing_v2.sql
-- Estende property_onboarding para suportar pricing por season (Stays).
--
-- Estrutura inspirada na lógica de Regions/Seasons da Stays API
-- (/external/v1/parr/price-regions e /external/v1/parr/listing-rates-sell):
--   - Cada unidade vincula a UMA Region (cadastrada no PMS).
--   - Region define os Periods (TEMP), Events (EVE), DOW (DIN), Delete (DEL).
--   - Cada combinação Period×Listing vira uma Season com _idseason único.
--   - Operador aplica price por season via PATCH .../listing-rates-sell/{seasonId}.

alter table property_onboarding
  -- _id Mongo da listing na Stays. Vem de warehouse.propriedades_subgrupos.Pricemaster_ID.
  -- Quando unidade espelha outra, este é o _id da mãe (Stays gerencia internamente).
  add column if not exists stays_listing_id text,

  -- Region escolhida no PMS. Cache pra UI; verdade final é a Stays.
  add column if not exists stays_region_id text,
  add column if not exists stays_region_name text,

  -- Snapshot das seasons no momento do enrichment (read-only, imutável).
  -- Array de { _idseason, name, from, to, baseRateValue, ratePlans, monthlyRate, type }
  add column if not exists stays_snapshot_seasons jsonb,

  -- Decisão do operador. Schema:
  -- { mode: 'manual'|'mirror'|'keep_current',
  --   mirror_source_idpropriedade?: string,
  --   seasons: [{ _idseason, approved_base_rate, approved_monthly_rate? }] }
  add column if not exists pricing_config jsonb,

  -- Status da sincronização com a Stays via PATCH em loop.
  -- 'pending'  → ainda não disparou
  -- 'syncing'  → em curso
  -- 'synced'   → todos PATCHes 200
  -- 'partial'  → alguns falharam (ver stays_sync_errors)
  -- 'error'    → falha generalizada (rede, auth)
  -- 'dry_run'  → executou em modo dry-run (sem PATCH real)
  add column if not exists stays_sync_status text default 'pending',
  add column if not exists stays_synced_at timestamptz,

  -- Detalhes de erros por season: [{ seasonId, status, message }]
  add column if not exists stays_sync_errors jsonb;

-- Índices para consultas comuns (dashboards de pricing, retry, etc.)
create index if not exists property_onboarding_stays_listing_idx
  on property_onboarding (stays_listing_id)
  where stays_listing_id is not null;

create index if not exists property_onboarding_stays_sync_status_idx
  on property_onboarding (stays_sync_status)
  where stays_sync_status in ('partial', 'error');

comment on column property_onboarding.stays_listing_id is
  'ObjectId Mongo da listing na Stays. Em espelhamento, _id da listing-mãe.';
comment on column property_onboarding.pricing_config is
  'Decisão do operador sobre preços por season. Aplicada no activate-unit.';
comment on column property_onboarding.stays_snapshot_seasons is
  'Snapshot read-only das seasons no momento do enrichment.';
