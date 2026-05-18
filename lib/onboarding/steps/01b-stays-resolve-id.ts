/**
 * Step 01b: Resolve o `Pricemaster_ID` (= _id Mongo da listing na Stays).
 *
 * O warehouse já mantém este mapping em `warehouse.propriedades_subgrupos`.
 * Quando a unidade espelha outra, `Pricemaster_ID` aponta para a listing-mãe
 * (o `pricemaster` text contém o nome da mãe).
 *
 * Saída no contexto: stays_listing_id, mirror_of (se aplicável).
 */

import { executeQuery } from "@/lib/bigquery-client"
import type { PipelineContext } from "../types"

const SQL = `
SELECT
  CAST(idPropriedade AS STRING) AS idpropriedade,
  CAST(nomePropriedade AS STRING) AS nome,
  CAST(Pricemaster_ID AS STRING) AS pricemaster_id,
  CAST(pricemaster AS STRING) AS pricemaster_nome
FROM \`warehouse.propriedades_subgrupos\`
WHERE CAST(idPropriedade AS STRING) = @idpropriedade
LIMIT 1
`

export interface StaysResolveResult {
    stays_listing_id: string | null
    is_mirror: boolean
    mirror_of_name: string | null
}

export async function staysResolveId(ctx: PipelineContext): Promise<StaysResolveResult> {
    const rows = await executeQuery<{
        idpropriedade: string
        nome: string | null
        pricemaster_id: string | null
        pricemaster_nome: string | null
    }>(SQL, { idpropriedade: ctx.idpropriedade })

    if (rows.length === 0 || !rows[0].pricemaster_id) {
        return { stays_listing_id: null, is_mirror: false, mirror_of_name: null }
    }

    const r = rows[0]
    const isMirror =
        !!r.pricemaster_nome && !!r.nome && r.pricemaster_nome.trim() !== r.nome.trim()

    return {
        stays_listing_id: r.pricemaster_id,
        is_mirror: isMirror,
        mirror_of_name: isMirror ? r.pricemaster_nome : null,
    }
}
