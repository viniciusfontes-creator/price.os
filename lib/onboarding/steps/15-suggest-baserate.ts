/**
 * Step 15: Sugere baserate inicial via mediana do sub_grupo no BQ
 * (stage.stays_listing_rates_sell últimos 30 dias).
 */

import { executeQuery } from "@/lib/bigquery-client"
import type { PipelineContext } from "../types"

const SQL = `
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

    const rows = await executeQuery<{ mediana: number | null; n: number }>(SQL, {
        sub_grupo: subGrupo,
    })
    if (!rows.length) return null
    const med = Number(rows[0].mediana)
    return Number.isFinite(med) && med > 0 ? Number(med.toFixed(2)) : null
}
