/**
 * Recálculo em cascata após edição manual.
 *
 * Modelo de dependência:
 *
 *   property_value  ──► meta_anual (=14%) ──► meta_distribuicao_mensal ──┐
 *                                                                          ├──► analise_financeira
 *                                                                          │
 *   property_appreciation ──► resumo_anual.valorizacao ────────────────────┤
 *                                                                          │
 *   quartos  ────────────► analise.parametros.quartos ────────────────────┤
 *                                                                          │
 *   meta_anual (override) ──► sobrescreve fórmula 14% ──► distribuicao ───┘
 *
 *   localidade ──► requer nova consulta BQ de praca_stats ──► full pipeline
 *
 * - Mudar `localidade` força refluxo completo (re-busca stats da nova praça).
 * - Mudar `meta_anual` direto desliga a fórmula `property_value × 0.14`
 *   apenas para esta unidade (flag `meta_anual_override`).
 * - Mudar `quartos` recalcula custo variável dos 12 meses.
 */

import {
    getOnboarding,
    logEvent,
    type OnboardingRow,
    updateOnboarding,
} from "./repository"
import { calculateTargets } from "./steps/05-calculate-targets"
import { financialAnalysis } from "./steps/06-financial-analysis"
import { pracaStats } from "./steps/04-praca-stats"
import { ONBOARDING_RULES } from "./constants"
import type {
    AnaliseFinanceira,
    JestorPayload,
    MetaDistribuicaoMensal,
    PipelineContext,
    PracaStats,
} from "./types"

/** Campos aceitos no PATCH com escopo de cascata. */
export interface EditableFields {
    // Disparam recálculo de derivados
    property_value?: number | null
    property_appreciation?: number | null
    quartos?: number | null
    meta_anual?: number | null
    localidade?: string | null

    // Metadado/contato — sem cascata
    notes?: string | null
    operator_email?: string | null
    owner_name?: string | null
    owner_email?: string | null
    owner_phone?: string | null
    rotulo?: string | null
    proprietario?: string | null
}

export interface RecalcReport {
    ok: boolean
    onboardingId: string
    changes: string[]
    cascade: {
        target_recomputed: boolean
        financial_recomputed: boolean
        praca_stats_reloaded: boolean
    }
    new_values: {
        meta_anual?: number | null
        roi?: string | null
        valor_liquido_anual?: number | null
    }
    error?: string
}

/**
 * Aplica edição manual com recálculo em cascata.
 *
 * Comportamento:
 *  - Atualiza campos plain (notes/owner_*) sem cascata.
 *  - Se mudar localidade: refluxo (re-fetch praca_stats + targets + financial).
 *  - Se mudar property_value/appreciation/quartos/meta_anual: refluxo dos
 *    derivados (targets + financial) reusando o praca_stats existente.
 *  - Se mudar Jestor payload campos (rotulo, proprietario, localidade):
 *    atualiza o JSONB jestor_payload para refletir.
 */
export async function applyEdits(
    onboardingId: string,
    edits: EditableFields,
    actorEmail: string
): Promise<RecalcReport> {
    const row = await getOnboarding(onboardingId)
    if (!row) {
        return {
            ok: false,
            onboardingId,
            changes: [],
            cascade: { target_recomputed: false, financial_recomputed: false, praca_stats_reloaded: false },
            new_values: {},
            error: "Onboarding não encontrado",
        }
    }

    // --- 1. Determina quais cascatas disparar ---
    const cascadeOnLocalidade = edits.localidade != null && edits.localidade !== getJestorPayloadField(row, "localidade")
    const cascadeOnValue =
        edits.property_value != null && Number(edits.property_value) !== Number(row.property_value)
    const cascadeOnAppreciation =
        edits.property_appreciation != null &&
        Number(edits.property_appreciation) !== Number(row.property_appreciation)
    const cascadeOnQuartos =
        edits.quartos != null && Number(edits.quartos) !== Number(getQuartos(row))
    const cascadeOnMetaAnual =
        edits.meta_anual != null && Number(edits.meta_anual) !== Number(row.meta_anual)

    const needsTargetsRecompute =
        cascadeOnValue || cascadeOnMetaAnual || cascadeOnLocalidade
    const needsFinancialRecompute =
        needsTargetsRecompute || cascadeOnAppreciation || cascadeOnQuartos

    // --- 2. Atualiza jestor_payload se algum campo do payload mudou ---
    const updatedJestor: JestorPayload = {
        ...(row.jestor_payload as unknown as JestorPayload),
    }
    if (edits.rotulo != null) updatedJestor.rotulo = edits.rotulo
    if (edits.proprietario != null) updatedJestor.proprietario = edits.proprietario
    if (edits.localidade != null) updatedJestor.localidade = edits.localidade
    if (edits.quartos != null) updatedJestor.quartos = edits.quartos

    // --- 3. Monta o context base com valores efetivos (edits sobrescrevem) ---
    const effectivePropertyValue =
        edits.property_value != null ? Number(edits.property_value) : Number(row.property_value || 0)
    const effectiveAppreciation =
        edits.property_appreciation != null
            ? Number(edits.property_appreciation)
            : Number(row.property_appreciation || 0)
    const effectiveMetaAnualOverride =
        edits.meta_anual != null ? Number(edits.meta_anual) : null

    // Sem override e sem cascata local: usa o que já está
    let newPracaStats: PracaStats | null =
        (row.bq_snapshot && (row.similar_properties as unknown)) // fallback: nada — vamos ler do banco abaixo
            ? null
            : null

    const baseCtx: PipelineContext = {
        onboardingId,
        idpropriedade: row.idpropriedade,
        payload: updatedJestor,
        bq: row.bq_snapshot as unknown as PipelineContext["bq"],
        similar: undefined,
        estimate: { propertyValue: effectivePropertyValue, propertyAppreciation: effectiveAppreciation },
        pracaStats: extractPracaStats(row),
        metaAnual: null as unknown as number,
        metaDistribuicao: extractDistribuicao(row),
        analiseFinanceira: row.analise_financeira as unknown as AnaliseFinanceira,
    }

    const changes: string[] = []
    const updates: Partial<OnboardingRow> = {}

    // Reload praca stats se mudou localidade
    if (cascadeOnLocalidade) {
        const ctxWithNewPraca = await pracaStats(baseCtx)
        newPracaStats = ctxWithNewPraca.pracaStats || null
        baseCtx.pracaStats = newPracaStats
        changes.push(`localidade: ${getJestorPayloadField(row, "localidade")} → ${edits.localidade}`)
    }

    // --- 4. Recalcula targets se necessário ---
    if (needsTargetsRecompute) {
        const ctxAfterTargets = await calculateTargets(baseCtx)

        // Se houve override manual de meta_anual, força esse valor e
        // re-escala a distribuição mensal proporcionalmente.
        if (effectiveMetaAnualOverride != null && ctxAfterTargets.metaAnual) {
            const ratio = effectiveMetaAnualOverride / ctxAfterTargets.metaAnual
            ctxAfterTargets.metaAnual = effectiveMetaAnualOverride
            ctxAfterTargets.metaDistribuicao = (ctxAfterTargets.metaDistribuicao || []).map((m) =>
                rescaleMonth(m, ratio)
            )
        }

        baseCtx.metaAnual = ctxAfterTargets.metaAnual
        baseCtx.metaDistribuicao = ctxAfterTargets.metaDistribuicao

        updates.meta_anual = baseCtx.metaAnual ?? null
        updates.meta_distribuicao_mensal = {
            items: baseCtx.metaDistribuicao || [],
        } as unknown as Record<string, unknown>

        if (cascadeOnValue) changes.push(`property_value: ${row.property_value} → ${effectivePropertyValue}`)
        if (cascadeOnMetaAnual) changes.push(`meta_anual override: ${row.meta_anual} → ${effectiveMetaAnualOverride}`)
    }

    // --- 5. Recalcula análise financeira se necessário ---
    if (needsFinancialRecompute) {
        const ctxAfterFinance = financialAnalysis(baseCtx)
        updates.analise_financeira = ctxAfterFinance.analiseFinanceira as unknown as Record<string, unknown>

        if (cascadeOnAppreciation)
            changes.push(`property_appreciation: ${row.property_appreciation} → ${effectiveAppreciation}`)
        if (cascadeOnQuartos)
            changes.push(`quartos: ${getQuartos(row)} → ${edits.quartos}`)
    }

    // --- 6. Atualiza campos diretos ---
    if (edits.property_value != null) updates.property_value = effectivePropertyValue
    if (edits.property_appreciation != null) updates.property_appreciation = effectiveAppreciation
    if (edits.notes != null && edits.notes !== row.notes) {
        updates.notes = edits.notes
        changes.push("notes")
    }
    if (edits.operator_email != null && edits.operator_email !== row.operator_email) {
        updates.operator_email = edits.operator_email
        changes.push("operator_email")
    }
    if (edits.owner_name != null && edits.owner_name !== row.owner_name) {
        updates.owner_name = edits.owner_name
        changes.push("owner_name")
    }
    if (edits.owner_email != null && edits.owner_email !== row.owner_email) {
        updates.owner_email = edits.owner_email
        changes.push("owner_email")
    }
    if (edits.owner_phone != null && edits.owner_phone !== row.owner_phone) {
        updates.owner_phone = edits.owner_phone
        changes.push("owner_phone")
    }
    if (
        edits.rotulo != null ||
        edits.proprietario != null ||
        edits.localidade != null ||
        edits.quartos != null
    ) {
        updates.jestor_payload = updatedJestor as unknown as Record<string, unknown>
    }

    // --- 7. Persiste ---
    if (Object.keys(updates).length > 0) {
        await updateOnboarding(onboardingId, updates)
    }

    await logEvent(onboardingId, row.idpropriedade, "manual_edit", {
        actor: actorEmail,
        changes,
        cascade: {
            target_recomputed: needsTargetsRecompute,
            financial_recomputed: needsFinancialRecompute,
            praca_stats_reloaded: cascadeOnLocalidade,
        },
    })

    const finalAnalise = (updates.analise_financeira ||
        row.analise_financeira) as unknown as AnaliseFinanceira | null

    return {
        ok: true,
        onboardingId,
        changes,
        cascade: {
            target_recomputed: needsTargetsRecompute,
            financial_recomputed: needsFinancialRecompute,
            praca_stats_reloaded: cascadeOnLocalidade,
        },
        new_values: {
            meta_anual: (updates.meta_anual ?? row.meta_anual) as number | null,
            roi: finalAnalise?.resumo_anual.rentabilidade_total_anual_perc ?? null,
            valor_liquido_anual: finalAnalise?.resumo_anual.valor_liquido_anual ?? null,
        },
    }
}

// ============================================
// Helpers
// ============================================

function getJestorPayloadField(row: OnboardingRow, field: string): unknown {
    const payload = row.jestor_payload as Record<string, unknown>
    return payload?.[field]
}

function getQuartos(row: OnboardingRow): number {
    const fromPayload = Number((row.jestor_payload as { quartos?: unknown }).quartos)
    if (Number.isFinite(fromPayload) && fromPayload > 0) return fromPayload
    const fromBq = Number((row.bq_snapshot as { _i_rooms?: unknown } | null)?._i_rooms)
    return Number.isFinite(fromBq) ? fromBq : 0
}

function extractPracaStats(row: OnboardingRow): PracaStats | null {
    // O snapshot do BQ não guarda stats — eles ficam em meta_distribuicao_mensal
    // implicitamente. Para recálculo de cascata SEM mudar localidade, podemos
    // reconstruir um PracaStats minimal apenas com os meses; mas calculate-targets
    // precisa de `detalhamento_mensal` da praça. Quando só mudamos valor/appreciation/
    // quartos/meta sem mudar localidade, mantemos a distribuição existente e só
    // ajustamos proporcionalmente — o caller faz isso via rescaleMonth.
    //
    // Retornamos um stub para que calculateTargets funcione: detalhamento_mensal
    // é derivado da última execução armazenada em meta_distribuicao_mensal.
    const items = extractDistribuicao(row) || []
    if (items.length === 0) return null
    return {
        praca: String((row.jestor_payload as { localidade?: string }).localidade || ""),
        total_propriedades_ano: 0,
        total_reservas_ano: 0,
        faturamento_total_ano: items.reduce((s, m) => s + m.meta_faturamento, 0),
        total_noites_ano: items.reduce((s, m) => s + m.meta_noites_2026, 0),
        detalhamento_mensal: items.map((m) => ({
            mes: m.mes,
            total_propriedades: 0,
            total_reservas: 0,
            faturamento_total: m.meta_faturamento,
            total_noites: m.meta_noites_2026,
            perc_faturamento_ano: 0,
            perc_ocupacao_ano: 0,
        })),
    }
}

function extractDistribuicao(row: OnboardingRow): MetaDistribuicaoMensal[] {
    const raw = row.meta_distribuicao_mensal as { items?: MetaDistribuicaoMensal[] } | null
    return raw?.items || []
}

/** Re-escala uma linha de meta mensal proporcionalmente a um ratio. */
function rescaleMonth(
    m: MetaDistribuicaoMensal,
    ratio: number
): MetaDistribuicaoMensal {
    const fat = Number((m.meta_faturamento * ratio).toFixed(2))
    const diaria = m.meta_noites_2026 > 0 ? Number((fat / m.meta_noites_2026).toFixed(2)) : 0
    const fer = m.feriado
        ? {
              ...m.feriado,
              faturamento_feriado: Number((m.feriado.faturamento_feriado * ratio).toFixed(2)),
              diaria_media_feriado:
                  m.feriado.noites_feriado > 0
                      ? Number((m.feriado.faturamento_feriado * ratio / m.feriado.noites_feriado).toFixed(2))
                      : 0,
          }
        : null
    const nao = {
        ...m.nao_feriado,
        faturamento_nao_feriado: Number((m.nao_feriado.faturamento_nao_feriado * ratio).toFixed(2)),
        diaria_media_nao_feriado:
            m.nao_feriado.noites_nao_feriado > 0
                ? Number(
                      (
                          (m.nao_feriado.faturamento_nao_feriado * ratio) /
                          m.nao_feriado.noites_nao_feriado
                      ).toFixed(2)
                  )
                : 0,
        lote_1: {
            ...m.nao_feriado.lote_1,
            faturamento: Number((m.nao_feriado.lote_1.faturamento * ratio).toFixed(2)),
        },
        lote_2: {
            ...m.nao_feriado.lote_2,
            faturamento: Number((m.nao_feriado.lote_2.faturamento * ratio).toFixed(2)),
        },
    }
    return {
        ...m,
        meta_faturamento: fat,
        meta_diaria_media: diaria,
        feriado: fer,
        nao_feriado: nao,
    }
}

// Mantém compatibilidade com fórmula padrão (META_ANUAL_PERC) — exportada
// caso a UI queira sinalizar "esse valor está em override manual".
export const META_ANUAL_FORMULA_PERC = ONBOARDING_RULES.META_ANUAL_PERC
