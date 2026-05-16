/**
 * Step 1: Hidrata o payload da Jestor com dados do BigQuery W1
 * (warehouse.propriedades_subgrupos).
 *
 * A Jestor manda lat/lng/quartos, mas pode faltar sub_grupo,
 * _i_maxguests, valor_tarifario, empreendimento_pousada e o
 * staysid_proprietario que precisamos para buscar contato do dono.
 */

import { executeQuery } from "@/lib/bigquery-client"
import type { BqHydratedProperty, PipelineContext } from "../types"

const SQL = `
SELECT
  CAST(p.idpropriedade AS STRING)            AS idpropriedade,
  p.nomepropriedade,
  p.nome_externo,
  p.grupo_nome,
  p.praca,
  p.sub_grupo,
  p.empreendimento_pousada,
  p.cidade,
  p.estado,
  SAFE_CAST(p.latitude  AS FLOAT64)          AS latitude,
  SAFE_CAST(p.longitude AS FLOAT64)          AS longitude,
  SAFE_CAST(p._i_maxguests AS INT64)         AS _i_maxguests,
  SAFE_CAST(p._i_rooms     AS INT64)         AS _i_rooms,
  SAFE_CAST(p.pricemaster      AS FLOAT64)   AS pricemaster,
  p.status_aparente,
  p.staysid_proprietario
FROM \`warehouse.propriedades_subgrupos\` p
WHERE CAST(p.idpropriedade AS STRING) = @idpropriedade
LIMIT 1
`

export async function hydrateBq(ctx: PipelineContext): Promise<PipelineContext> {
    const rows = await executeQuery<BqHydratedProperty>(SQL, {
        idpropriedade: ctx.idpropriedade,
    })
    const bq = rows[0] || null
    return { ...ctx, bq }
}
