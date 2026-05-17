-- 011_stays_webhook_events.sql
-- Log de eventos recebidos da Stays via webhook (POST /api/stays/webhook).
-- O schema é deliberadamente flexível: o payload bruto fica em JSONB e
-- inferimos event_type / entity_id na inserção para facilitar consultas.

create table if not exists public.stays_webhook_events (
    id           uuid primary key default gen_random_uuid(),
    received_at  timestamptz not null default now(),
    event_type   text,
    entity_id    text,
    payload      jsonb not null,
    headers      jsonb,
    processed_at timestamptz,
    processing_error text
);

create index if not exists stays_webhook_events_received_at_idx
    on public.stays_webhook_events (received_at desc);

create index if not exists stays_webhook_events_event_type_idx
    on public.stays_webhook_events (event_type)
    where event_type is not null;

create index if not exists stays_webhook_events_entity_id_idx
    on public.stays_webhook_events (entity_id)
    where entity_id is not null;

create index if not exists stays_webhook_events_unprocessed_idx
    on public.stays_webhook_events (received_at)
    where processed_at is null;

alter table public.stays_webhook_events enable row level security;

-- Apenas service_role lê/escreve. Sem políticas para anon/authenticated.
comment on table public.stays_webhook_events is
    'Webhooks recebidos da Stays External API. Insert via service_role apenas.';
