-- =============================================
-- Migration 007: Proprietário Reports
-- Apresentações em PDF para proprietários das unidades
-- =============================================

CREATE TABLE IF NOT EXISTS proprietario_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Autoria (NextAuth: identificamos por email)
    created_by_email TEXT NOT NULL,

    -- Escopo do relatório
    idpropriedade TEXT NOT NULL,
    nome_propriedade TEXT,                    -- snapshot legível p/ listagem
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    template_key TEXT NOT NULL DEFAULT 'mensal_v1',

    -- Estado
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','published','archived')),

    -- Customização: overrides do estagiário por slide
    -- Shape: [{ key: 'resumo_executivo', visible: true, overrides: { titulo?: string, texto?: string } }]
    slides JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Snapshot imutável dos dados do BQ no momento da geração — congela os números
    snapshot_data JSONB,

    -- Export & share
    pdf_url TEXT,
    share_token TEXT UNIQUE,
    share_expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_reports_user
    ON proprietario_reports(created_by_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_reports_prop
    ON proprietario_reports(idpropriedade, periodo_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_owner_reports_share
    ON proprietario_reports(share_token) WHERE share_token IS NOT NULL;

-- Touch updated_at on every UPDATE
CREATE OR REPLACE FUNCTION touch_proprietario_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proprietario_reports_touch ON proprietario_reports;
CREATE TRIGGER trg_proprietario_reports_touch
BEFORE UPDATE ON proprietario_reports
FOR EACH ROW EXECUTE FUNCTION touch_proprietario_reports_updated_at();
