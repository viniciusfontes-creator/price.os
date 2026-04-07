// ============================================
// CALCULATION TOOLS
// Wraps lib/calculations.ts functions
// ============================================

import type { ToolDefinition, ToolResult } from '../types'
import { executeQuery } from '@/lib/bigquery-client'

export const calculationTools: ToolDefinition[] = [
  {
    name: 'calculate_property_status',
    description:
      'Calcula o status (A/B/C/D/E) de uma propriedade. A(>=100% Meta Mensal), B(>=80% Meta Movel), C(>=50% Meta Movel), D(<50% Meta Movel mas >0,1%), E(<0,1%).',
    parameters: {
      property_id: {
        type: 'string',
        description: 'ID da propriedade',
        required: true,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['analyst', 'operations'],
    execute: async (params): Promise<ToolResult> => {
      try {
        const now = new Date()
        const mesAno = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`

        const sql = `
WITH receita AS (
  SELECT SUM(CAST(reservetotal AS NUMERIC)) AS realizado
  FROM \`warehouse.reservas_all\`
  WHERE idpropriedade = '${String(params.property_id).replace(/'/g, "''")}'
    AND LOWER(type) NOT LIKE '%canceled%'
    AND buyprice > 0
    AND FORMAT_DATE('%m/%Y', SAFE.PARSE_DATE('%d-%m-%Y', checkoutdate)) = '${mesAno}'
),
meta AS (
  SELECT
    SUM(SAFE_CAST(meta AS NUMERIC)) AS meta,
    SUM(SAFE_CAST(meta_movel AS NUMERIC)) AS meta_movel
  FROM \`warehouse.meta_e_meta_movel_checkout\`
  WHERE idpropriedade = '${String(params.property_id).replace(/'/g, "''")}'
    AND FORMAT_DATE('%m/%Y', SAFE.PARSE_DATE('%Y-%m-%d', data_especifica)) = '${mesAno}'
)
SELECT
  COALESCE(r.realizado, 0) AS realizado,
  COALESCE(m.meta, 0) AS meta,
  COALESCE(m.meta_movel, 0) AS meta_movel,
  CASE WHEN m.meta > 0 THEN ROUND(COALESCE(r.realizado, 0) / m.meta * 100, 1) ELSE 0 END AS percentual
FROM receita r, meta m`

        const rows = await executeQuery<{ realizado: number; meta: number; meta_movel: number; percentual: number }>(sql)
        const row = rows[0] || { realizado: 0, meta: 0, meta_movel: 0, percentual: 0 }
        const realizado = Number(row.realizado)
        const meta = Number(row.meta)
        const metaMovel = Number(row.meta_movel)
        let status: 'A' | 'B' | 'C' | 'D' | 'E' = 'E'
        if (meta > 0 && (realizado / meta) * 100 >= 100) status = 'A'
        else if (metaMovel > 0) {
          const pctMovel = (realizado / metaMovel) * 100
          if (pctMovel >= 80) status = 'B'
          else if (pctMovel >= 50) status = 'C'
          else if (pctMovel >= 0.1) status = 'D'
          else status = 'E'
        } else if (realizado >= 0.1) status = 'D'

        return {
          success: true,
          data: { ...row, status },
          summary: `Propriedade ${params.property_id}: R$ ${realizado.toFixed(2)} de R$ ${meta.toFixed(2)} (Meta Movel R$ ${metaMovel.toFixed(2)}) - Status ${status}.`,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro',
          summary: 'Falha ao calcular status.',
        }
      }
    },
  },
  {
    name: 'compare_properties',
    description:
      'Compara metricas lado a lado de 2 ou mais propriedades: receita, meta, ocupacao, ADR.',
    parameters: {
      property_ids: {
        type: 'array',
        description: 'Lista de IDs das propriedades para comparar (separados por virgula)',
        required: true,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['analyst', 'pricing'],
    execute: async (params): Promise<ToolResult> => {
      try {
        const idsRaw = String(params.property_ids)
        const ids = idsRaw.split(',').map((id) => id.trim().replace(/'/g, "''"))
        if (ids.length === 0) {
          return { success: false, error: 'Nenhum ID fornecido', summary: 'IDs nao informados.' }
        }

        const idList = ids.map((id) => `'${id}'`).join(',')
        const now = new Date()
        const mesAno = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`

        const sql = `
WITH receita AS (
  SELECT idpropriedade, SUM(CAST(reservetotal AS NUMERIC)) AS realizado, COUNT(*) AS total_reservas,
    ROUND(AVG(CAST(pricepernight AS NUMERIC)), 2) AS adr
  FROM \`warehouse.reservas_all\`
  WHERE idpropriedade IN (${idList})
    AND LOWER(type) NOT LIKE '%canceled%' AND buyprice > 0
    AND FORMAT_DATE('%m/%Y', SAFE.PARSE_DATE('%d-%m-%Y', checkoutdate)) = '${mesAno}'
  GROUP BY 1
),
metas AS (
  SELECT IdPropriedade AS idpropriedade, SAFE_CAST(meta AS NUMERIC) AS meta
  FROM \`stage.metas_checkout_mensais_unidade\`
  WHERE IdPropriedade IN (${idList}) AND mes_ano = '${mesAno}'
)
SELECT p.idpropriedade, p.nomepropriedade, p.praca,
  COALESCE(r.realizado, 0) AS realizado, COALESCE(m.meta, 0) AS meta,
  COALESCE(r.total_reservas, 0) AS total_reservas, COALESCE(r.adr, 0) AS adr,
  CASE WHEN m.meta > 0 THEN ROUND(COALESCE(r.realizado, 0) / m.meta * 100, 1) ELSE 0 END AS percentual
FROM \`warehouse.propriedades_subgrupos\` p
LEFT JOIN receita r ON p.idpropriedade = r.idpropriedade
LEFT JOIN metas m ON p.idpropriedade = m.idpropriedade
WHERE p.idpropriedade IN (${idList})`

        const rows = await executeQuery(sql)
        return {
          success: true,
          data: rows,
          summary: `Comparacao de ${rows.length} propriedades para ${mesAno}.`,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro',
          summary: 'Falha na comparacao.',
        }
      }
    },
  },
]
