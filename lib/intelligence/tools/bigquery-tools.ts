// ============================================
// BIGQUERY TOOLS
// Wraps existing bigquery-service.ts functions
// ============================================

import type { ToolDefinition, ToolResult } from '../types'
import { executeQuery } from '@/lib/bigquery-client'

async function safeQuery<T>(sql: string): Promise<ToolResult> {
  try {
    const rows = await executeQuery<T>(sql)
    return {
      success: true,
      data: rows,
      summary: `Consulta retornou ${rows.length} resultados.`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao consultar BigQuery',
      summary: 'Falha na consulta ao BigQuery.',
    }
  }
}

/**
 * Build property type filter clause for SQL WHERE
 */
function buildPropertyTypeFilter(propertyType?: string, tableAlias = 'p'): string {
  if (propertyType === 'short-stay') {
    return `AND ${tableAlias}.empreendimento_pousada IN ('Short Stay', 'Alto Padrão')`
  }
  if (propertyType === 'hotelaria') {
    return `AND ${tableAlias}.empreendimento_pousada = 'Empreendimento'`
  }
  return ''
}

/**
 * Build praca filter clause for SQL WHERE
 */
function buildPracaFilter(praca?: string, tableAlias = 'p'): string {
  if (praca) {
    const sanitized = String(praca).replace(/'/g, "''")
    return `AND LOWER(${tableAlias}.praca) LIKE '%${sanitized.toLowerCase()}%'`
  }
  return ''
}

export const bigqueryTools: ToolDefinition[] = [
  {
    name: 'query_revenue_by_property',
    description:
      'Consulta receita e metricas de reservas por propriedade. Retorna nome, praca, receita_total, total_reservas, adr_medio, total_noites. Pode filtrar por tipo (short-stay/hotelaria) e praca.',
    parameters: {
      property_id: {
        type: 'string',
        description: 'ID da propriedade (opcional, se vazio retorna todas)',
        required: false,
      },
      date_start: {
        type: 'string',
        description: 'Data inicio no formato YYYY-MM-DD (checkout >= date_start)',
        required: false,
      },
      date_end: {
        type: 'string',
        description: 'Data fim no formato YYYY-MM-DD (checkout <= date_end)',
        required: false,
      },
      property_type: {
        type: 'string',
        description: 'Tipo de propriedade: "short-stay", "hotelaria" ou "all" (padrao: all)',
        required: false,
        enum: ['short-stay', 'hotelaria', 'all'],
      },
      praca: {
        type: 'string',
        description: 'Filtrar por praca (ex: "Porto de Galinhas", "Maragogi")',
        required: false,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['analyst', 'pricing', 'operations'],
    execute: async (params) => {
      const conditions = [
        "r.partnername <> 'External API'",
        'r.buyprice > 0',
        'r.reservetotal > 0',
        "LOWER(r.type) NOT LIKE '%canceled%'",
        "p.status_aparente = 'Ativa'",
      ]

      if (params.property_id) {
        conditions.push(`r.idpropriedade = '${String(params.property_id).replace(/'/g, "''")}'`)
      }
      if (params.date_start) {
        conditions.push(
          `FORMAT_DATE('%Y-%m-%d', SAFE.PARSE_DATE('%d-%m-%Y', r.checkoutdate)) >= '${String(params.date_start).replace(/'/g, "''")}'`
        )
      }
      if (params.date_end) {
        conditions.push(
          `FORMAT_DATE('%Y-%m-%d', SAFE.PARSE_DATE('%d-%m-%Y', r.checkoutdate)) <= '${String(params.date_end).replace(/'/g, "''")}'`
        )
      }

      const typeFilter = buildPropertyTypeFilter(params.property_type as string)
      const pracaFilter = buildPracaFilter(params.praca as string)

      const sql = `
SELECT
  r.idpropriedade,
  p.nomepropriedade,
  p.praca,
  p.grupo_nome,
  p.empreendimento_pousada,
  SUM(CAST(r.reservetotal AS NUMERIC)) AS receita_total,
  COUNT(*) AS total_reservas,
  ROUND(AVG(CAST(r.pricepernight AS NUMERIC)), 2) AS adr_medio,
  SUM(CAST(r.nightcount AS INT64)) AS total_noites,
  ROUND(AVG(CAST(
    GREATEST(DATE_DIFF(SAFE.PARSE_DATE('%d-%m-%Y', r.checkindate), SAFE.PARSE_DATE('%d-%m-%Y', r.creationdate), DAY), 0)
  AS INT64)), 0) AS antecedencia_media
FROM \`warehouse.reservas_all\` r
JOIN \`warehouse.propriedades_subgrupos\` p ON r.idpropriedade = p.idpropriedade
WHERE ${conditions.join(' AND ')}
  ${typeFilter}
  ${pracaFilter}
GROUP BY r.idpropriedade, p.nomepropriedade, p.praca, p.grupo_nome, p.empreendimento_pousada
ORDER BY receita_total DESC
LIMIT 100`

      const result = await safeQuery(sql)
      if (result.success && Array.isArray(result.data)) {
        result.summary = `Receita consultada para ${(result.data as unknown[]).length} propriedades.`
      }
      return result
    },
  },
  {
    name: 'query_reservations',
    description:
      'Consulta reservas detalhadas com filtros. Retorna dados individuais de cada reserva (valor, canal, agente, datas).',
    parameters: {
      property_id: {
        type: 'string',
        description: 'ID da propriedade',
        required: false,
      },
      partner_name: {
        type: 'string',
        description: 'Canal de venda (Airbnb, Booking, etc)',
        required: false,
      },
      date_start: {
        type: 'string',
        description: 'Data inicio YYYY-MM-DD (por checkout)',
        required: false,
      },
      date_end: {
        type: 'string',
        description: 'Data fim YYYY-MM-DD (por checkout)',
        required: false,
      },
      limit: {
        type: 'number',
        description: 'Limite de resultados (padrao 50)',
        required: false,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['analyst', 'operations'],
    execute: async (params) => {
      const conditions = [
        "partnername <> 'External API'",
        'buyprice > 0',
        "LOWER(type) NOT LIKE '%canceled%'",
      ]

      if (params.property_id) {
        conditions.push(`idpropriedade = '${String(params.property_id).replace(/'/g, "''")}'`)
      }
      if (params.partner_name) {
        conditions.push(`LOWER(partnername) LIKE '%${String(params.partner_name).toLowerCase().replace(/'/g, "''").replace(/%/g, '')}%'`)
      }
      if (params.date_start) {
        conditions.push(
          `FORMAT_DATE('%Y-%m-%d', SAFE.PARSE_DATE('%d-%m-%Y', checkoutdate)) >= '${String(params.date_start).replace(/'/g, "''")}'`
        )
      }
      if (params.date_end) {
        conditions.push(
          `FORMAT_DATE('%Y-%m-%d', SAFE.PARSE_DATE('%d-%m-%Y', checkoutdate)) <= '${String(params.date_end).replace(/'/g, "''")}'`
        )
      }

      const limit = Math.min(Number(params.limit) || 50, 200)

      const sql = `
SELECT
  idpropriedade,
  CAST(reservetotal AS NUMERIC) AS reservetotal,
  CAST(pricepernight AS NUMERIC) AS pricepernight,
  CAST(nightcount AS INT64) AS nightcount,
  FORMAT_DATE('%Y-%m-%d', SAFE.PARSE_DATE('%d-%m-%Y', checkoutdate)) AS checkoutdate,
  FORMAT_DATE('%Y-%m-%d', SAFE.PARSE_DATE('%d-%m-%Y', creationdate)) AS creationdate,
  FORMAT_DATE('%Y-%m-%d', SAFE.PARSE_DATE('%d-%m-%Y', checkindate)) AS checkindate,
  partnername, agentname, guesttotalcount
FROM \`warehouse.reservas_all\`
WHERE ${conditions.join(' AND ')}
ORDER BY FORMAT_DATE('%Y-%m-%d', SAFE.PARSE_DATE('%d-%m-%Y', creationdate)) DESC
LIMIT ${limit}`

      return safeQuery(sql)
    },
  },
  {
    name: 'query_sales_performance',
    description:
      'Consulta performance de vendas mensal: receita por propriedade vs meta, com status de atingimento (A/B/C/D/E). Pode filtrar por tipo (short-stay/hotelaria), praca, grupo e status.',
    parameters: {
      month: {
        type: 'number',
        description: 'Mes (1-12). Padrao: mes atual',
        required: false,
      },
      year: {
        type: 'number',
        description: 'Ano. Padrao: ano atual',
        required: false,
      },
      property_type: {
        type: 'string',
        description: 'Tipo de propriedade: "short-stay", "hotelaria" ou "all" (padrao: all)',
        required: false,
        enum: ['short-stay', 'hotelaria', 'all'],
      },
      praca: {
        type: 'string',
        description: 'Filtrar por praca (ex: "Porto de Galinhas")',
        required: false,
      },
      grupo: {
        type: 'string',
        description: 'Filtrar por grupo (ex: "Beach Park")',
        required: false,
      },
      status_filter: {
        type: 'string',
        description: 'Filtrar por status especifico: A, B, C, D ou E',
        required: false,
        enum: ['A', 'B', 'C', 'D', 'E'],
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['analyst', 'pricing'],
    execute: async (params) => {
      const now = new Date()
      const month = Number(params.month) || now.getMonth() + 1
      const year = Number(params.year) || now.getFullYear()
      const mesAno = `${String(month).padStart(2, '0')}/${year}`

      const typeFilter = buildPropertyTypeFilter(params.property_type as string)
      const pracaFilter = buildPracaFilter(params.praca as string)
      const grupoFilter = params.grupo
        ? `AND LOWER(p.grupo_nome) LIKE '%${String(params.grupo).replace(/'/g, "''").toLowerCase()}%'`
        : ''

      // If status_filter is provided, we wrap the query to filter after calculation
      const statusFilter = params.status_filter
        ? String(params.status_filter).toUpperCase()
        : ''

      const sql = `
WITH receita AS (
  SELECT
    idpropriedade,
    SUM(CAST(reservetotal AS NUMERIC)) AS realizado
  FROM \`warehouse.reservas_all\`
  WHERE LOWER(type) NOT LIKE '%canceled%'
    AND buyprice > 0
    AND FORMAT_DATE('%m/%Y', SAFE.PARSE_DATE('%d-%m-%Y', checkoutdate)) = '${mesAno}'
  GROUP BY 1
),
metas AS (
  SELECT IdPropriedade AS idpropriedade, SAFE_CAST(meta AS NUMERIC) AS meta
  FROM \`stage.metas_checkout_mensais_unidade\`
  WHERE mes_ano = '${mesAno}'
),
performance AS (
  SELECT
    p.idpropriedade,
    p.nomepropriedade,
    p.praca,
    p.grupo_nome,
    p.empreendimento_pousada,
    COALESCE(r.realizado, 0) AS realizado,
    COALESCE(m.meta, 0) AS meta,
    CASE WHEN m.meta > 0 THEN ROUND(COALESCE(r.realizado, 0) / m.meta * 100, 1) ELSE 0 END AS percentual_atingido,
    CASE
      WHEN COALESCE(m.meta, 0) = 0 THEN 'E'
      WHEN COALESCE(r.realizado, 0) / m.meta >= 1.0 THEN 'A'
      WHEN COALESCE(r.realizado, 0) / m.meta >= 0.8 THEN 'B'
      WHEN COALESCE(r.realizado, 0) / m.meta >= 0.6 THEN 'C'
      WHEN COALESCE(r.realizado, 0) / m.meta >= 0.4 THEN 'D'
      ELSE 'E'
    END AS status,
    ROUND(COALESCE(m.meta, 0) - COALESCE(r.realizado, 0), 2) AS gap_absoluto
  FROM \`warehouse.propriedades_subgrupos\` p
  LEFT JOIN receita r ON p.idpropriedade = r.idpropriedade
  LEFT JOIN metas m ON p.idpropriedade = m.idpropriedade
  WHERE p.status_aparente = 'Ativa'
    ${typeFilter}
    ${pracaFilter}
    ${grupoFilter}
)
SELECT * FROM performance
${statusFilter ? `WHERE status = '${statusFilter}'` : ''}
ORDER BY gap_absoluto DESC`

      const result = await safeQuery(sql)
      if (result.success && Array.isArray(result.data)) {
        const data = result.data as Array<Record<string, unknown>>
        const total = data.reduce((s, r) => s + Number(r.realizado || 0), 0)
        const metaTotal = data.reduce((s, r) => s + Number(r.meta || 0), 0)
        const gapTotal = data.reduce((s, r) => s + Math.max(Number(r.gap_absoluto || 0), 0), 0)
        const statusDist = { A: 0, B: 0, C: 0, D: 0, E: 0 } as Record<string, number>
        data.forEach((r) => {
          const s = String(r.status || 'E')
          if (s in statusDist) statusDist[s]++
        })
        result.summary = `Performance ${mesAno}: ${data.length} propriedades. Realizado R$ ${total.toFixed(2)} de R$ ${metaTotal.toFixed(2)} em meta (${metaTotal > 0 ? ((total / metaTotal) * 100).toFixed(1) : 0}%). Gap total: R$ ${gapTotal.toFixed(2)}. Status: A=${statusDist.A}, B=${statusDist.B}, C=${statusDist.C}, D=${statusDist.D}, E=${statusDist.E}.`
      }
      return result
    },
  },
  {
    name: 'query_occupancy',
    description:
      'Consulta calendario de ocupacao das propriedades para os proximos 90 dias. Mostra noites vendidas, disponiveis, bloqueadas. Pode filtrar por tipo e praca.',
    parameters: {
      property_id: {
        type: 'string',
        description: 'ID da propriedade (opcional)',
        required: false,
      },
      days_ahead: {
        type: 'number',
        description: 'Dias a frente para consultar (padrao 30, max 90)',
        required: false,
      },
      property_type: {
        type: 'string',
        description: 'Tipo: "short-stay", "hotelaria" ou "all" (padrao: all)',
        required: false,
        enum: ['short-stay', 'hotelaria', 'all'],
      },
      praca: {
        type: 'string',
        description: 'Filtrar por praca',
        required: false,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['analyst', 'operations', 'pricing'],
    execute: async (params) => {
      const daysAhead = Math.min(Number(params.days_ahead) || 30, 90)
      const propFilter = params.property_id
        ? `AND idPropriedade = '${String(params.property_id).replace(/'/g, "''")}'`
        : ''
      const typeFilter = buildPropertyTypeFilter(params.property_type as string)
      const pracaFilter = buildPracaFilter(params.praca as string)

      const sql = `
SELECT
  o.idpropriedade,
  p.nomepropriedade,
  p.praca,
  p.grupo_nome,
  COUNTIF(o.ocupado = 1 AND o.ocupado_proprietario = 0 AND o.manutencao = 0) AS noites_vendidas,
  COUNTIF(o.ocupado = 0 AND o.ocupado_proprietario = 0 AND o.manutencao = 0 AND o.disponivel = 1) AS noites_disponiveis,
  COUNTIF(o.ocupado_proprietario = 1) AS bloqueio_proprietario,
  COUNTIF(o.manutencao = 1) AS manutencao,
  COUNT(*) AS total_noites,
  ROUND(SAFE_DIVIDE(COUNTIF(o.ocupado = 1 AND o.ocupado_proprietario = 0 AND o.manutencao = 0), COUNT(*)) * 100, 1) AS taxa_ocupacao
FROM (
  SELECT idPropriedade AS idpropriedade, DATE(datas) AS datas,
    MAX(ocupado) AS ocupado, MAX(ocupado_proprietario) AS ocupado_proprietario,
    MAX(manutencao) AS manutencao, MAX(disponivel) AS disponivel
  FROM \`stage.ocupacaoDisponibilidade_teste1\`
  WHERE DATE(datas) BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)
    ${propFilter}
  GROUP BY 1, 2
) o
JOIN \`warehouse.propriedades_subgrupos\` p ON o.idpropriedade = p.idpropriedade
WHERE p.status_aparente = 'Ativa'
  ${typeFilter}
  ${pracaFilter}
GROUP BY o.idpropriedade, p.nomepropriedade, p.praca, p.grupo_nome
ORDER BY noites_disponiveis DESC`

      const result = await safeQuery(sql)
      if (result.success && Array.isArray(result.data)) {
        const data = result.data as Array<Record<string, unknown>>
        const totalDisp = data.reduce((s, r) => s + Number(r.noites_disponiveis || 0), 0)
        result.summary = `Ocupacao (proximos ${daysAhead} dias) para ${data.length} propriedades. Total de ${totalDisp} noites disponiveis.`
      }
      return result
    },
  },
  {
    name: 'query_property_details',
    description:
      'Busca detalhes de propriedades: nome, praca, grupo, tipo, quartos, hospedes, lat/lon, tarifa base. Pode buscar por nome, ID, praca ou grupo.',
    parameters: {
      search: {
        type: 'string',
        description: 'Nome ou ID da propriedade para buscar',
        required: false,
      },
      praca: {
        type: 'string',
        description: 'Buscar todas propriedades de uma praca',
        required: false,
      },
      grupo: {
        type: 'string',
        description: 'Buscar todas propriedades de um grupo',
        required: false,
      },
      property_type: {
        type: 'string',
        description: 'Tipo: "short-stay", "hotelaria" ou "all"',
        required: false,
        enum: ['short-stay', 'hotelaria', 'all'],
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['analyst', 'pricing', 'market', 'operations'],
    execute: async (params) => {
      const conditions = ["p.status_aparente = 'Ativa'"]

      if (params.search) {
        const search = String(params.search).replace(/'/g, "''")
        conditions.push(`(LOWER(p.nomepropriedade) LIKE '%${search.toLowerCase()}%' OR p.idpropriedade = '${search}')`)
      }
      if (params.praca) {
        const praca = String(params.praca).replace(/'/g, "''")
        conditions.push(`LOWER(p.praca) LIKE '%${praca.toLowerCase()}%'`)
      }
      if (params.grupo) {
        const grupo = String(params.grupo).replace(/'/g, "''")
        conditions.push(`LOWER(p.grupo_nome) LIKE '%${grupo.toLowerCase()}%'`)
      }

      const typeFilter = buildPropertyTypeFilter(params.property_type as string)

      const sql = `
SELECT
  p.idpropriedade, p.nomepropriedade, p.praca, p.grupo_nome,
  p.empreendimento_pousada, p.sub_grupo, p._i_maxguests, p._i_rooms,
  p.latitude, p.longitude,
  t.baserate_atual
FROM \`warehouse.propriedades_subgrupos\` p
LEFT JOIN (
  SELECT id, ROUND(AVG(baseratevalue), 2) AS baserate_atual
  FROM \`stage.stays_listing_rates_sell\` GROUP BY 1
) t ON p.idpropriedade = t.id
WHERE ${conditions.join(' AND ')}
  ${typeFilter}
ORDER BY p.nomepropriedade
LIMIT 50`

      return safeQuery(sql)
    },
  },
  {
    name: 'query_channel_ranking',
    description:
      'Ranking de canais de venda (partnername) ou agentes por receita, numero de reservas e ticket medio. Pode filtrar por tipo e praca.',
    parameters: {
      group_by: {
        type: 'string',
        description: 'Agrupar por "canal" (partnername) ou "agente" (agentname)',
        required: true,
        enum: ['canal', 'agente'],
      },
      date_start: {
        type: 'string',
        description: 'Data inicio YYYY-MM-DD',
        required: false,
      },
      date_end: {
        type: 'string',
        description: 'Data fim YYYY-MM-DD',
        required: false,
      },
      property_type: {
        type: 'string',
        description: 'Tipo: "short-stay", "hotelaria" ou "all"',
        required: false,
        enum: ['short-stay', 'hotelaria', 'all'],
      },
      praca: {
        type: 'string',
        description: 'Filtrar por praca',
        required: false,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['analyst'],
    execute: async (params) => {
      const groupField = params.group_by === 'agente' ? 'r.agentname' : 'r.partnername'
      const conditions = [
        "r.partnername <> 'External API'",
        'r.buyprice > 0',
        "LOWER(r.type) NOT LIKE '%canceled%'",
        "p.status_aparente = 'Ativa'",
      ]
      if (params.date_start) {
        conditions.push(
          `FORMAT_DATE('%Y-%m-%d', SAFE.PARSE_DATE('%d-%m-%Y', r.checkoutdate)) >= '${String(params.date_start).replace(/'/g, "''")}'`
        )
      }
      if (params.date_end) {
        conditions.push(
          `FORMAT_DATE('%Y-%m-%d', SAFE.PARSE_DATE('%d-%m-%Y', r.checkoutdate)) <= '${String(params.date_end).replace(/'/g, "''")}'`
        )
      }

      const typeFilter = buildPropertyTypeFilter(params.property_type as string)
      const pracaFilter = buildPracaFilter(params.praca as string)

      const sql = `
SELECT
  ${groupField} AS nome,
  SUM(CAST(r.reservetotal AS NUMERIC)) AS receita_total,
  COUNT(*) AS total_reservas,
  ROUND(AVG(CAST(r.reservetotal AS NUMERIC)), 2) AS ticket_medio,
  SUM(CAST(r.nightcount AS INT64)) AS total_noites
FROM \`warehouse.reservas_all\` r
JOIN \`warehouse.propriedades_subgrupos\` p ON r.idpropriedade = p.idpropriedade
WHERE ${conditions.join(' AND ')}
  ${typeFilter}
  ${pracaFilter}
GROUP BY 1
ORDER BY receita_total DESC
LIMIT 30`

      return safeQuery(sql)
    },
  },
]
