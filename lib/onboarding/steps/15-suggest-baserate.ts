/**
 * Step 15: Sugere baserate por SEASON (v2).
 *
 * Antes (v1): retornava um único número (mediana do sub_grupo). Falhava
 * silenciosamente quando sub_grupo era null e ignorava sazonalidade.
 *
 * Agora (v2): para cada season do snapshot, sugere um valor baseado em:
 *   1. baseRateValue atual da Stays (se a season já existe → ponto de partida)
 *   2. Mediana do `stays_listing_rates_sell` por sub_grupo + período (BQ)
 *   3. Ajuste de sazonalidade: se o nome da season contém marcador de
 *      evento premium (Reveillon, Carnaval, Semana Santa), aplica multiplicador.
 *
 * Para retro-compat com código antigo, exporta também `suggestBaserate` que
 * devolve a mediana global como single number (usado por outros locais
 * do app que ainda não migraram para o modelo por season).
 */

import { executeQuery } from "@/lib/bigquery-client"
import type { ListingSeason } from "@/lib/stays/pricing"
import type { PipelineContext } from "../types"

// ---------------------------------------------------------------------------
// v1 (compat): retorna mediana flat. Mantido só por compat — não usar em código novo.
// ---------------------------------------------------------------------------

const SQL_MEDIANA = `
WITH base AS (
  SELECT
    r.id,
    p.sub_grupo,
    SAFE_CAST(r.baseRateValue AS NUMERIC) AS rate
  FROM \`stage.stays_listing_rates_sell\` r
  JOIN \`warehouse.propriedades_subgrupos\` p ON p.idpropriedade = r.id
  WHERE r.baseRateValue IS NOT NULL
    AND p.sub_grupo = @sub_grupo
    AND r.\`from\` >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
)
SELECT
  APPROX_QUANTILES(rate, 100)[OFFSET(50)] AS mediana,
  COUNT(*) AS n
FROM base
`

export async function suggestBaserate(ctx: PipelineContext): Promise<number | null> {
    const subGrupo = ctx.bq?.sub_grupo
    if (!subGrupo) return null
    const rows = await executeQuery<{ mediana: number | null; n: number }>(SQL_MEDIANA, {
        sub_grupo: subGrupo,
    })
    if (!rows.length) return null
    const med = Number(rows[0].mediana)
    return Number.isFinite(med) && med > 0 ? Number(med.toFixed(2)) : null
}

// ---------------------------------------------------------------------------
// v2 — sugestão por season (usa metaDistribuicao do step 05)
// ---------------------------------------------------------------------------
//
// Estratégia: a aba "Análise" já calcula a diária ideal por mês a partir da
// meta anual + distribuição por feriado. Reaproveitamos esses números como
// SUGESTÃO no card Pricing — em vez de "manter valor atual" (que não agrega).
//
// Para cada season da Stays:
//   1. Identifica o mês (start_date)
//   2. Se a season é curta (≤7 dias) e o mês tem feriado configurado →
//      usa `feriado.diaria_media_feriado`
//   3. Caso contrário → usa `meta_diaria_media` (diária do mês inteiro)
//   4. Compara com baseRateValue atual da Stays e monta reason explicativo
//
// Fallback (sem metaDistribuicao): mediana do sub_grupo (lógica v1).
// ---------------------------------------------------------------------------

export interface SeasonSuggestion {
    _idseason: string
    seasonFrom: string
    seasonTo: string
    currentBaseRate: number | null
    suggestedBaseRate: number | null
    reason: string
    needsMonthlyRate: boolean
}

const MES_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

function diffDays(from: string, to: string): number {
    return Math.round(
        (new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) /
            86400000,
    )
}

function fmtBRL(v: number): string {
    return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function describeDelta(current: number | null, suggested: number): string {
    if (current == null) return ""
    const delta = ((suggested - current) / current) * 100
    if (Math.abs(delta) < 1) return " (alinhado com atual)"
    const sign = delta > 0 ? "+" : ""
    return ` (atual ${fmtBRL(current)}, ${sign}${delta.toFixed(0)}%)`
}

export async function suggestSeasonBaserates(
    ctx: PipelineContext,
    snapshot: ListingSeason[]
): Promise<SeasonSuggestion[]> {
    if (snapshot.length === 0) return []

    const meta = ctx.metaDistribuicao || []
    const metaByMonth = new Map(meta.map((m) => [m.mes, m]))

    // Fallback: mediana do sub_grupo se metaDistribuicao estiver vazia.
    let mediana: number | null = null
    if (meta.length === 0 && ctx.bq?.sub_grupo) {
        const rows = await executeQuery<{ mediana: number | null }>(SQL_MEDIANA, {
            sub_grupo: ctx.bq.sub_grupo,
        })
        const m = Number(rows[0]?.mediana)
        if (Number.isFinite(m) && m > 0) mediana = Number(m.toFixed(2))
    }

    /**
     * Match v4: overlap REAL de datas entre o feriado e a season da Stays.
     * Anteriormente v3 fazia match por mês, o que causava bugs como rotular
     * "30/abr→04/mai 2027" como Semana Santa (Páscoa 2027 = 28/mar).
     *
     * Considera overlap quando os intervalos [from, to-1) e [s.from, s.to-1)
     * têm pelo menos 1 dia em comum. Fallback: se o feriado não tem `from/to`
     * (sazonalidade antiga sem regra), volta ao match por mês.
     */
    function findEventOverlap(s: ListingSeason): {
        month: string
        event: {
            nome: string
            noites_feriado: number
            diaria_media_feriado: number
            faturamento_feriado: number
        }
    } | null {
        const sFromMs = new Date(s.from + "T00:00:00Z").getTime()
        const sToMsInclusive = new Date(s.to + "T00:00:00Z").getTime() - 86400000
        const sFromMonth = new Date(sFromMs).getUTCMonth()
        const sToMonth = new Date(sToMsInclusive).getUTCMonth()

        // Bucket de candidatos: feriados com overlap real (>0 dias).
        const candidates: Array<{
            month: string
            event: NonNullable<typeof meta[number]["feriados"]>[number]
            overlapDays: number
            hasDates: boolean
        }> = []

        for (const m of meta) {
            for (const f of m.feriados ?? []) {
                if ((f.noites_feriado || 0) <= 0) continue
                if (f.from && f.to) {
                    const fFromMs = new Date(f.from + "T00:00:00Z").getTime()
                    const fToMsInclusive = new Date(f.to + "T00:00:00Z").getTime() - 86400000
                    const overlapStart = Math.max(sFromMs, fFromMs)
                    const overlapEnd = Math.min(sToMsInclusive, fToMsInclusive)
                    const overlapDays =
                        overlapEnd >= overlapStart
                            ? Math.round((overlapEnd - overlapStart) / 86400000) + 1
                            : 0
                    if (overlapDays > 0) {
                        candidates.push({ month: m.mes, event: f, overlapDays, hasDates: true })
                    }
                } else {
                    // Fallback legacy: match por mês quando feriado não tem datas.
                    const monthIdx = MES_PT.indexOf(m.mes)
                    if (monthIdx === sFromMonth || monthIdx === sToMonth) {
                        candidates.push({ month: m.mes, event: f, overlapDays: 0, hasDates: false })
                    }
                }
            }
        }
        if (candidates.length === 0) return null

        // Prefere matches com datas reais e maior overlap. Em empate, menor diária
        // (conservador).
        candidates.sort((a, b) => {
            if (a.hasDates !== b.hasDates) return a.hasDates ? -1 : 1
            if (a.overlapDays !== b.overlapDays) return b.overlapDays - a.overlapDays
            return a.event.diaria_media_feriado - b.event.diaria_media_feriado
        })
        const winner = candidates[0]
        return { month: winner.month, event: winner.event }
    }

    return snapshot.map((s) => {
        const fromDate = new Date(s.from + "T00:00:00Z")
        const toDateInclusive = new Date(new Date(s.to + "T00:00:00Z").getTime() - 86400000)
        const startMonth = MES_PT[fromDate.getUTCMonth()]
        const endMonth = MES_PT[toDateInclusive.getUTCMonth()]
        const days = diffDays(s.from, s.to)
        const isShort = days <= 10

        const startMeta = metaByMonth.get(startMonth)
        const endMeta = metaByMonth.get(endMonth)

        let suggested: number | null = null
        let reason: string

        // Estratégia v3:
        // 1. Se season curta → procura evento da sazonalidade que cobre as datas
        // 2. Se season longa (mês cheio) → usa diaria_media_media do mês
        // 3. Fallback: mediana sub_grupo
        const eventMatch = isShort ? findEventOverlap(s) : null

        if (eventMatch) {
            suggested = Number(eventMatch.event.diaria_media_feriado.toFixed(2))
            reason = `${eventMatch.event.nome} (meta: ${eventMatch.event.noites_feriado} noites a ${fmtBRL(suggested)})${describeDelta(s.baseRateValue, suggested)}`
        } else if (startMeta || endMeta) {
            // Período longo (mês cheio) → diária dos dias NORMAIS (não inclui feriados).
            // Feriados têm seasons curtas próprias na Stays e são tratados pelo eventMatch.
            const chosenMeta = startMeta ?? endMeta!
            const chosenMonth = startMeta ? startMonth : endMonth
            const naoFeriado = chosenMeta.nao_feriado
            suggested = Number(
                (naoFeriado?.diaria_media_nao_feriado ?? chosenMeta.meta_diaria_media).toFixed(2),
            )
            const noites = naoFeriado?.noites_nao_feriado ?? chosenMeta.meta_noites_2026
            const fat = naoFeriado?.faturamento_nao_feriado ?? chosenMeta.meta_faturamento
            reason = `Diária dia normal de ${chosenMonth} (meta sem feriados: ${fmtBRL(fat)} ÷ ${noites} noites)${describeDelta(s.baseRateValue, suggested)}`
        } else if (s.baseRateValue && mediana) {
            suggested = mediana
            reason = `Sem meta de ${startMonth} — fallback: mediana sub_grupo${describeDelta(s.baseRateValue, mediana)}`
        } else if (s.baseRateValue) {
            suggested = s.baseRateValue
            reason = `Sem meta de ${startMonth} — manter valor atual`
        } else if (mediana) {
            suggested = mediana
            reason = `Sem meta nem valor atual — mediana sub_grupo`
        } else {
            reason = `Sem meta de ${startMonth} nem fallback disponível`
        }

        return {
            _idseason: s._idseason,
            seasonFrom: s.from,
            seasonTo: s.to,
            currentBaseRate: s.baseRateValue ?? null,
            suggestedBaseRate: suggested,
            reason,
            needsMonthlyRate: !!s.monthlyRate,
        }
    })
}
