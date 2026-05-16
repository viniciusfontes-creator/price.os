-- =============================================
-- Migration 010: novo modelo de fases do Onboarding
--
-- Antes:  recebida, em_analise, estudo_pronto, apresentado,
--         aguardando_aprovacao, ativada, arquivada
-- Depois: fila, processamento_ia, revisao, aprovacao,
--         concluido, arquivada
--
-- Mapeamento de registros existentes:
--   recebida              → fila
--   em_analise            → processamento_ia
--   estudo_pronto         → revisao
--   apresentado           → revisao
--   aguardando_aprovacao  → aprovacao
--   ativada               → concluido
--   arquivada             → arquivada
--
-- A coluna revisao_since registra quando entrou em "revisao" para o
-- cron que após 48h move automaticamente para "aprovacao".
-- =============================================

ALTER TABLE property_onboarding
    DROP CONSTRAINT IF EXISTS property_onboarding_state_check;

UPDATE property_onboarding SET state = 'fila'             WHERE state = 'recebida';
UPDATE property_onboarding SET state = 'processamento_ia' WHERE state = 'em_analise';
UPDATE property_onboarding SET state = 'revisao'          WHERE state IN ('estudo_pronto','apresentado');
UPDATE property_onboarding SET state = 'aprovacao'        WHERE state = 'aguardando_aprovacao';
UPDATE property_onboarding SET state = 'concluido'        WHERE state = 'ativada';

ALTER TABLE property_onboarding
    ALTER COLUMN state SET DEFAULT 'fila';

ALTER TABLE property_onboarding
    ADD CONSTRAINT property_onboarding_state_check
    CHECK (state IN (
        'fila',
        'processamento_ia',
        'revisao',
        'aprovacao',
        'concluido',
        'arquivada'
    ));

ALTER TABLE property_onboarding
    ADD COLUMN IF NOT EXISTS revisao_since TIMESTAMPTZ;

DROP INDEX IF EXISTS idx_onboarding_state;
CREATE INDEX idx_onboarding_state
    ON property_onboarding(state) WHERE state NOT IN ('concluido','arquivada');
