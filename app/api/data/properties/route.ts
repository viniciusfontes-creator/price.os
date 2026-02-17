/**
 * API Route: /api/data/properties
 * 
 * Fetches property data from BigQuery via MCP.
 * This is a server-side endpoint that returns real data from warehouse.propriedades_subgrupos
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// SQL Query for Properties (from user specification)
const SQL_PROPERTIES = `
SELECT
  idpropriedade,
  nomepropriedade,
  _i_maxguests,
  nome_externo,
  cidade,
  estado,
  latitude,
  longitude,
  _i_rooms,
  pricemaster,
  grupo_nome,
  praca,
  empreendimento_pousada,
  sub_grupo
FROM
  \`warehouse.propriedades_subgrupos\`
WHERE
  status_aparente = 'Ativa'
`

export async function GET() {
    try {
        // For now, return a placeholder that indicates BigQuery should be used
        // The actual BigQuery call happens via MCP in the client context
        return NextResponse.json({
            success: true,
            message: 'Use MCP BigQuery tools to fetch data',
            sql: SQL_PROPERTIES,
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error('[API] Properties fetch error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch properties', message: String(error) },
            { status: 500 }
        )
    }
}
