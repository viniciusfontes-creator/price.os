-- 013_seasonalities_stays_region.sql
-- Etapa 1 da integração Sazonalidade ↔ Region: persiste o vínculo no banco
-- ao invés de inferir por nome de praça em código (frágil).
--
-- Escopo desta migration: apenas Short-Stay. Hotelaria/Mensalista virá
-- numa migration futura quando expandirmos o escopo.

alter table public.seasonalities
  add column if not exists stays_region_id text,
  add column if not exists stays_region_name text;

comment on column public.seasonalities.stays_region_id is
  'ObjectId Mongo da Price Region na Stays. Mapeamento 1:1 para Short-Stay.';
comment on column public.seasonalities.stays_region_name is
  'Cache do nome da Region — facilita exibição sem chamada à API.';

create index if not exists seasonalities_stays_region_idx
  on public.seasonalities (stays_region_id)
  where stays_region_id is not null;
