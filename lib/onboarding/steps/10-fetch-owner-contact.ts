/**
 * Step 10: Busca dados de contato do proprietário no BigQuery.
 *
 * Replica o node "Buscar dados do proprietário" do sub-workflow n8n
 * [Owner] Apresentação Qavi.imob: JOIN entre warehouse.propriedades_subgrupos
 * e stage.usuarios pelo staysid_proprietario.
 */

import { executeQuery } from "@/lib/bigquery-client"
import type { PipelineContext } from "../types"

export interface OwnerContact {
    idpropriedade: string
    nomePropriedade: string | null
    name: string | null
    telefone: string | null
    email: string | null
}

const SQL = `
SELECT
  CAST(p.IdPropriedade AS STRING) AS idpropriedade,
  p.nomePropriedade,
  u.name,
  u.telefone,
  u.email
FROM \`warehouse.propriedades_subgrupos\` AS p
LEFT JOIN \`stage.usuarios\` AS u
  ON u.staysid = p.staysid_proprietario
WHERE CAST(p.idpropriedade AS STRING) = @idpropriedade
LIMIT 1
`

export async function fetchOwnerContact(
    ctx: PipelineContext
): Promise<OwnerContact | null> {
    const rows = await executeQuery<OwnerContact>(SQL, {
        idpropriedade: ctx.idpropriedade,
    })
    return rows[0] || null
}
