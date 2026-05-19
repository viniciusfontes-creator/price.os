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
     * Match v3: tenta achar o EVENTO específico no array `feriados[]` de cada mês
     * cujas datas se sobrepõem com a season da Stays. Se nenhum evento bate,
     * usa diária do mês cheio.
     */
    function findEventOverlap(s: ListingSeason): { month: string; event: { nome: string; noites_feriado: number; diaria_media_feriado: number; faturamento_feriado: number } } | null {
        const sFrom = new Date(s.from + "T00:00:00Z")
        const sToInclusive = new Date(new Date(s.to + "T00:00:00Z").getTime() - 86400000)
        for (const m of meta) {
            for (const f of m.feriados ?? []) {
                // Não temos as datas dos feriados[] (vêm da sazonalidade), aproximamos
                // por NOME + MÊS. Refinamento: armazenar from/to no array tb.
                if ((f.noites_feriado || 0) > 0) {
                    const monthIdx = MES_PT.indexOf(m.mes)
                    if (monthIdx === sFrom.getUTCMonth() || monthIdx === sToInclusive.getUTCMonth()) {
                        // Match por proximidade (mês). Se temos múltiplos eventos no mês,
                        // o de menor diária ganha (mais conservador).
                        return { month: m.mes, event: f }
                    }
                }
            }
        }
        return null
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
            // Período longo → diária média do mês de start (ou end se vazio)
            const chosenMeta = startMeta ?? endMeta!
            const chosenMonth = startMeta ? startMonth : endMonth
            suggested = Number(chosenMeta.meta_diaria_media.toFixed(2))
            reason = `Diária média de ${chosenMonth} (meta: ${fmtBRL(chosenMeta.meta_faturamento)} ÷ ${chosenMeta.meta_noites_2026} noites)${describeDelta(s.baseRateValue, suggested)}`
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
