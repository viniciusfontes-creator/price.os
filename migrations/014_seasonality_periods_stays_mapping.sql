-- 014_seasonality_periods_stays_mapping.sql
-- Etapa 2 da escadinha — Period (Price.OS) ↔ Season Template (Stays).
--
-- Schema "Opção C" do plano: armazena AMBOS current (datas materializadas
-- pro ano corrente) e rule (fórmula computável pra anos futuros).
--
-- Exemplo de payloads:
--
-- Mês cheio (June 2026):
--   { "kind": "month_full", "month": 6,
--     "current": { "from": "2026-06-01", "to": "2026-07-01",
--                  "stays_template_id": "69334f5a94c37a2890504e4a" } }
--
-- Réveillon (data fixa atravessando ano):
--   { "kind": "fixed", "month_start": 12, "day_start": 26,
--     "duration_days": 8,
--     "current": { "from": "2026-12-26", "to": "2027-01-03",
--                  "stays_template_id": "..." } }
--
-- Carnaval (move com Páscoa):
--   { "kind": "easter_offset", "offset_days": -47, "duration_days": 7,
--     "current": { "from": "2027-02-04", "to": "2027-02-11",
--                  "stays_template_id": "..." } }
--
-- A rule é aplicada por `lib/onboarding/stays-period-rule.ts` para
-- projetar datas em qualquer ano futuro.

alter table public.seasonality_periods
  add column if not exists stays_period jsonb;

comment on column public.seasonality_periods.stays_period is
  'Vínculo com template Stays + rule pra projeção. Schema "Opção C" — { rule, current }';

create index if not exists seasonality_periods_stays_template_idx
  on public.seasonality_periods ((stays_period->'current'->>'stays_template_id'))
  where stays_period is not null;
