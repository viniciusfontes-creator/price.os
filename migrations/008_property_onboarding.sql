-- =============================================
-- Migration 008: Property Onboarding (Jestor → Price.OS)
-- Internaliza o workflow [Onboarding] Precificação e Estudo de Rentabilidade
-- e o sub-workflow [Owner] Apresentação Qavi.imob
-- =============================================

CREATE TABLE IF NOT EXISTS property_onboarding (
    id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Chave de negócio + idempotência
    idpropriedade            TEXT UNIQUE NOT NULL,
    jestor_record_id         TEXT,

    -- Payload bruto recebido da Jestor (mantém para auditoria/replay)
    jestor_payload           JSONB NOT NULL,

    -- Estado no Kanban
    state                    TEXT NOT NULL DEFAULT 'recebida'
        CHECK (state IN (
            'recebida',
            'em_analise',
            'estudo_pronto',
            'apresentado',
            'aguardando_aprovacao',
            'ativada',
            'arquivada'
        )),

    -- Snapshots de hidratação (preenchidos pelo pipeline)
    bq_snapshot              JSONB,            -- WebhookPropriedade hidratada do BQ W1
    similar_properties       JSONB,            -- saída do RPC buscar_imoveis_semelhantes (Supabase Qaviinvest)

    -- Resultados da análise (Estudo de Rentabilidade)
    property_value           NUMERIC,
    property_appreciation    NUMERIC,
    meta_anual               NUMERIC,
    meta_distribuicao_mensal JSONB,
    analise_financeira       JSONB,

    -- Artefatos do Estudo
    pdf_url                  TEXT,
    pdf_drive_file_id        TEXT,

    -- Artefatos da Apresentação ao proprietário
    owner_name               TEXT,
    owner_email              TEXT,
    owner_phone              TEXT,
    owner_email_sent_at      TIMESTAMPTZ,
    pitchdeck_pdf_url        TEXT,
    pitchdeck_drive_file_id  TEXT,
    pitchdeck_generated_at   TIMESTAMPTZ,

    -- Sugestões automáticas (Price.OS exclusivo, não vem do n8n)
    suggested_baserate       NUMERIC,
    suggested_basket         JSONB,
    suggested_sazonalidades  JSONB,
    matched_airbnb_listing   TEXT,

    -- Decisões do operador
    approved_by              TEXT,             -- email do operador
    approved_baserate        NUMERIC,
    approved_basket_id       UUID,             -- referência a competitor_baskets

    -- Metadata
    notes                    TEXT,
    operator_email           TEXT,             -- responsável

    -- Timestamps de pipeline
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    enriched_at              TIMESTAMPTZ,
    pdf_generated_at         TIMESTAMPTZ,
    activated_at             TIMESTAMPTZ,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_state
    ON property_onboarding(state) WHERE state != 'ativada';
CREATE INDEX IF NOT EXISTS idx_onboarding_jestor_record
    ON property_onboarding(jestor_record_id) WHERE jestor_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_onboarding_created
    ON property_onboarding(created_at DESC);

-- =============================================
-- Log de eventos do pipeline (auditoria + debug)
-- =============================================
CREATE TABLE IF NOT EXISTS property_onboarding_events (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    onboarding_id   UUID REFERENCES property_onboarding(id) ON DELETE CASCADE,
    idpropriedade   TEXT NOT NULL,            -- denormalizado para query rápida
    event_type      TEXT NOT NULL,            -- received | enrichment_started | gemini_called | targets_calculated | pdf_generated | owner_email_sent | pitchdeck_generated | activated | error | state_changed
    payload         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_id
    ON property_onboarding_events(onboarding_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_idprop
    ON property_onboarding_events(idpropriedade, created_at DESC);

-- =============================================
-- Trigger: updated_at
-- =============================================
CREATE OR REPLACE FUNCTION touch_property_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_onboarding_touch ON property_onboarding;
CREATE TRIGGER trg_property_onboarding_touch
BEFORE UPDATE ON property_onboarding
FOR EACH ROW EXECUTE FUNCTION touch_property_onboarding_updated_at();

-- =============================================
-- RLS: service_role only (mesmo padrão da migration 001)
-- =============================================
ALTER TABLE property_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_onboarding_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access onboarding" ON property_onboarding;
CREATE POLICY "Service role full access onboarding" ON property_onboarding
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access onboarding events" ON property_onboarding_events;
CREATE POLICY "Service role full access onboarding events" ON property_onboarding_events
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
