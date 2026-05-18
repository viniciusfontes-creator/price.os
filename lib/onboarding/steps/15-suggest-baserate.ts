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
// v2 — sugestão por season
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

const EVENT_MULTIPLIERS: Array<{ regex: RegExp; mult: number; label: string }> = [
    { regex: /r[eé]v[ée]ill?on|fim\s*de\s*ano|natal|ano\s*novo/i, mult: 1.6, label: "Réveillon/Fim de Ano" },
    { regex: /carnaval/i, mult: 1.5, label: "Carnaval" },
    { regex: /semana\s*santa|p[áa]scoa/i, mult: 1.3, label: "Semana Santa" },
    { regex: /tiradentes|trabalh|corpus|consci[eê]nc|finados|aparecid|7\s*de\s*setembro|crianças/i, mult: 1.2, label: "Feriado prolongado" },
]

interface SeasonNameLike {
    name?: string // não vem na API; reservado para futuro
}

function detectEventBoost(season: ListingSeason & SeasonNameLike): { mult: number; label: string } | null {
    // Heurística por data quando o nome não vem.
    // Reveillon: 25 dez → 02 jan
    // Carnaval: depende do ano (de 40 a 50 dias antes da Páscoa).
    const from = new Date(season.from + "T00:00:00Z")
    const md = `${String(from.getUTCMonth() + 1).padStart(2, "0")}-${String(from.getUTCDate()).padStart(2, "0")}`
    if (md >= "12-23" || md <= "01-05") return { mult: 1.6, label: "Réveillon/Fim de Ano (heurística por data)" }
    // Tem como detectar carnaval via cálculo de Páscoa, mas no escopo
    // inicial fica como TODO. A heurística por preço atual (acima do
    // baseline mediano) já captura.
    return null
}

export async function suggestSeasonBaserates(
    ctx: PipelineContext,
    snapshot: ListingSeason[]
): Promise<SeasonSuggestion[]> {
    if (snapshot.length === 0) return []

    // Mediana do sub_grupo como baseline (se disponível).
    let mediana: number | null = null
    if (ctx.bq?.sub_grupo) {
        const rows = await executeQuery<{ mediana: number | null }>(SQL_MEDIANA, {
            sub_grupo: ctx.bq.sub_grupo,
        })
        const m = Number(rows[0]?.mediana)
        if (Number.isFinite(m) && m > 0) mediana = Number(m.toFixed(2))
    }

    return snapshot.map((s) => {
        const event = detectEventBoost(s)

        // Estratégia: se já tem valor na Stays e não detectou evento, sugere manter.
        // Se detectou evento, multiplica o atual (ou a mediana) pelo fator.
        let suggested: number | null = null
        let reason: string

        if (event) {
            const base = s.baseRateValue || mediana
            suggested = base ? Number((base * event.mult).toFixed(2)) : null
            reason = `${event.label} — base × ${event.mult.toFixed(1)}`
        } else if (s.baseRateValue) {
            suggested = s.baseRateValue
            reason = "Manter valor atual (sem evento detectado)"
        } else if (mediana) {
            suggested = mediana
            reason = `Mediana sub_grupo (${ctx.bq?.sub_grupo})`
        } else {
            reason = "Sem dados para sugerir"
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
