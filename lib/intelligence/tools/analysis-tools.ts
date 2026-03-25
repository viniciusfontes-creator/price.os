// ============================================
// ANALYSIS TOOLS
// Composite analytical tools: PHS, historical bookings, peer comparison
// ============================================

import type { ToolDefinition, ToolResult } from '../types'
import { executeQuery } from '@/lib/bigquery-client'
import { getSupabaseAdmin } from '@/lib/supabase-server'

// ── Shared filter builders ──────────────────────────

function typeFilter(propertyType?: string, alias = 'p'): string {
  if (propertyType === 'short-stay') return `AND ${alias}.empreendimento_pousada IN ('Short Stay', 'Alto Padrão')`
  if (propertyType === 'hotelaria') return `AND ${alias}.empreendimento_pousada = 'Empreendimento'`
  return ''
}

function pracaFilter(praca?: string, alias = 'p'): string {
  if (!praca) return ''
  const s = String(praca).replace(/'/g, "''").toLowerCase()
  return `AND LOWER(${alias}.praca) LIKE '%${s}%'`
}

function sanitize(val: unknown): string {
  return String(val ?? '').replace(/'/g, "''")
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// ── PHS scoring functions ───────────────────────────

function scoreD1(vitrine: number, sugerido: number): number {
  if (!sugerido || sugerido <= 0) return 50
  const delta = Math.abs(vitrine - sugerido) / sugerido
  return Math.max(0, Math.round(100 - delta * 200))
}

function scoreD2(realizado: number, meta: number): number {
  if (!meta || meta <= 0) return 50
  return Math.min(100, Math.round((realizado / meta) * 100))
}

function scoreD3(vendidas: number, disponiveis: number): number {
  const total = vendidas + disponiveis
  if (total <= 0) return 50
  return Math.round((vendidas / total) * 100)
}

function scoreD4(adrHistorico: number, tarifaAtual: number): number {
  if (!adrHistorico || !tarifaAtual || adrHistorico <= 0 || tarifaAtual <= 0) return 50
  const ratio = adrHistorico / tarifaAtual
  if (ratio >= 0.7 && ratio <= 1.3) return 100
  if (ratio < 0.7) return Math.max(0, Math.round(100 - (0.7 - ratio) * 300))
  return Math.max(0, Math.round(100 - (ratio - 1.3) * 300))
}

function scoreD5(nossoPreco: number, medianaMercado: number, ocupacao: number): number {
  if (!medianaMercado || medianaMercado <= 0 || !nossoPreco) return 50
  const delta = (nossoPreco - medianaMercado) / medianaMercado
  // If overpriced and low occupancy = very bad
  if (delta > 0.15 && ocupacao < 50) return Math.max(0, Math.round(50 - delta * 100))
  // If underpriced and high occupancy = somewhat bad (leaving money)
  if (delta < -0.15 && ocupacao > 75) return Math.max(0, Math.round(70 - Math.abs(delta) * 100))
  // Well positioned
  if (Math.abs(delta) <= 0.15) return 90
  return 60
}

function calculatePHS(d1: number, d2: number, d3: number, d4: number, d5: number): number {
  return Math.round(d1 * 0.30 + d2 * 0.25 + d3 * 0.20 + d4 * 0.15 + d5 * 0.10)
}

function determineDirection(
  vitrine: number, sugerido: number, mediana: number, ocupacao: number
): 'OVERPRICED' | 'UNDERPRICED' | 'ALIGNED' {
  if (vitrine > sugerido && mediana > 0 && vitrine > mediana && ocupacao < 50) return 'OVERPRICED'
  if (sugerido > 0 && vitrine < sugerido * 0.85 && ocupacao > 75) return 'UNDERPRICED'
  return 'ALIGNED'
}

// ── Tools ───────────────────────────────────────────

export const analysisTools: ToolDefinition[] = [
  // ── 1. PRICING HEALTH SCORE ─────────────────────
  {
    name: 'analyze_pricing_health',
    description:
      'Analise composta de saude de precificacao. Calcula Pricing Health Score (PHS) 0-100 com 5 dimensoes: alinhamento modelo, proximidade meta, ocupacao, historico, mercado. Retorna ranking de propriedades da pior para a melhor.',
    parameters: {
      praca: { type: 'string', description: 'Filtrar por praca (ex: "Pipa", "Porto de Galinhas")', required: false },
      property_type: { type: 'string', description: '"short-stay", "hotelaria" ou "all"', required: false, enum: ['short-stay', 'hotelaria', 'all'] },
      property_id: { type: 'string', description: 'Analisar propriedade especifica (opcional)', required: false },
      top_n: { type: 'number', description: 'Quantidade de resultados (default 15)', required: false },
    },
    requiresConfirmation: false,
    allowedAgents: ['pricing', 'analyst'],
    execute: async (params): Promise<ToolResult> => {
      try {
        const tf = typeFilter(params.property_type as string)
        const pf = pracaFilter(params.praca as string)
        const propFilter = params.property_id ? `AND p.IdPropriedade = '${sanitize(params.property_id)}'` : ''
        const topN = Number(params.top_n) || 15

        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()
        const lastYearMonth = currentMonth
        const lastYear = currentYear - 1

        // Big CTE: pricing + occupancy + historical ADR + meta + baserate
        const sql = `
WITH LeadTimeDinamico AS (
  SELECT p.praca,
    CAST(ROUND(AVG(DATE_DIFF(SAFE.PARSE_DATE('%d-%m-%Y', r.checkInDate), SAFE.PARSE_DATE('%d-%m-%Y', r.creationDate), DAY)),0) AS INT64) AS lead_time_momento
  FROM warehouse.propriedades_subgrupos p
  JOIN warehouse.reservas_all r ON p.IdPropriedade = r.idPropriedade
  WHERE r.type != 'canceled' AND SAFE.PARSE_DATE('%d-%m-%Y', r.creationDate) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY 1
),
Props AS (
  SELECT p.IdPropriedade, p.nomePropriedade, p.praca, p.grupo_nome, p._i_maxguests,
    COALESCE(ltd.lead_time_momento, 0) AS lead_time_momento,
    EXTRACT(MONTH FROM DATE_ADD(CURRENT_DATE(), INTERVAL COALESCE(ltd.lead_time_momento,0) DAY)) AS mes_alvo,
    EXTRACT(YEAR FROM DATE_ADD(CURRENT_DATE(), INTERVAL COALESCE(ltd.lead_time_momento,0) DAY)) AS ano_alvo
  FROM warehouse.propriedades_subgrupos p
  LEFT JOIN LeadTimeDinamico ltd ON p.praca = ltd.praca
  WHERE p.Status_Aparente = 'Ativa'
  ${tf} ${pf} ${propFilter}
),
OcupacaoMes AS (
  SELECT idpropriedade, EXTRACT(MONTH FROM datas) AS mes, EXTRACT(YEAR FROM datas) AS ano,
    COUNTIF(ocupado = 1 AND ocupado_proprietario = 0 AND manutencao = 0) AS noites_vendidas,
    COUNTIF(ocupado = 0 AND ocupado_proprietario = 0 AND manutencao = 0) AS noites_livres
  FROM (SELECT idPropriedade, DATE(datas) AS datas, MAX(ocupado) as ocupado, MAX(ocupado_proprietario) as ocupado_proprietario, MAX(manutencao) as manutencao
    FROM stage.ocupacaoDisponibilidade_teste1 GROUP BY 1, 2)
  GROUP BY 1,2,3
),
Ocupacao30d AS (
  SELECT idpropriedade,
    COUNTIF(ocupado = 1 AND ocupado_proprietario = 0 AND manutencao = 0) AS vendidas_30d,
    COUNTIF(ocupado = 0 AND ocupado_proprietario = 0 AND manutencao = 0) AS disponiveis_30d
  FROM (SELECT idPropriedade, DATE(datas) AS datas, MAX(ocupado) as ocupado, MAX(ocupado_proprietario) as ocupado_proprietario, MAX(manutencao) as manutencao
    FROM stage.ocupacaoDisponibilidade_teste1
    WHERE datas >= CURRENT_DATETIME() AND datas < DATETIME_ADD(CURRENT_DATETIME(), INTERVAL 30 DAY)
    GROUP BY 1, 2)
  GROUP BY 1
),
FinanceiroMes AS (
  SELECT r.idPropriedade, EXTRACT(MONTH FROM SAFE.PARSE_DATE('%d-%m-%Y', r.checkOutDate)) AS mes,
    EXTRACT(YEAR FROM SAFE.PARSE_DATE('%d-%m-%Y', r.checkOutDate)) AS ano,
    SUM(r.reserveTotal) AS faturamento_realizado
  FROM warehouse.reservas_all r WHERE r.type != 'canceled' GROUP BY 1,2,3
),
TarifarioAtual AS (
  SELECT t.id, ROUND(t.baseRateValue, 2) AS baserate_atual
  FROM stage.stays_listing_rates_sell t
  INNER JOIN (SELECT id, MAX(\`from\`) AS max_from FROM stage.stays_listing_rates_sell
    WHERE \`from\` <= CURRENT_DATE() AND baseRateValue IS NOT NULL GROUP BY id
  ) latest ON t.id = latest.id AND t.\`from\` = latest.max_from
  WHERE t.baseRateValue IS NOT NULL
),
ADRHistorico AS (
  SELECT r.idPropriedade,
    ROUND(AVG(r.pricepernight), 2) AS adr_historico,
    COUNT(*) AS reservas_historico
  FROM warehouse.reservas_all r
  WHERE r.type != 'canceled' AND r.buyprice != -1 AND r.partnername != 'External API'
    AND EXTRACT(MONTH FROM SAFE.PARSE_DATE('%d-%m-%Y', r.checkOutDate)) = ${lastYearMonth}
    AND EXTRACT(YEAR FROM SAFE.PARSE_DATE('%d-%m-%Y', r.checkOutDate)) = ${lastYear}
  GROUP BY 1
),
BaseModelo AS (
  SELECT a.IdPropriedade, a.nomePropriedade, a.praca, a.grupo_nome, a._i_maxguests,
    a.lead_time_momento, a.mes_alvo, a.ano_alvo,
    m.meta AS meta_mes, COALESCE(f.faturamento_realizado,0) AS realizado_mes,
    (m.meta - COALESCE(f.faturamento_realizado,0)) AS gap_faturamento,
    COALESCE(o.noites_vendidas, 0) AS noites_vendidas_mes,
    COALESCE(o.noites_livres, 0) AS noites_livres_mes,
    COALESCE(o30.vendidas_30d, 0) AS vendidas_30d,
    COALESCE(o30.disponiveis_30d, 0) AS disponiveis_30d,
    SAFE_DIVIDE(m.meta, 20) AS preco_min_absoluto,
    t.baserate_atual,
    h.adr_historico,
    h.reservas_historico,
    LEAST(COALESCE(o.noites_livres, 0), GREATEST(18 - COALESCE(o.noites_vendidas, 0), 0)) AS noites_para_venda_efetiva
  FROM Props a
  LEFT JOIN stage.metas_checkout_mensais_unidade m ON a.IdPropriedade = m.IdPropriedade AND m.mes_ano = FORMAT('%02d/%d', a.mes_alvo, a.ano_alvo)
  LEFT JOIN FinanceiroMes f ON a.IdPropriedade = f.idPropriedade AND f.mes = a.mes_alvo AND f.ano = a.ano_alvo
  LEFT JOIN OcupacaoMes o ON a.IdPropriedade = o.idpropriedade AND o.mes = a.mes_alvo AND o.ano = a.ano_alvo
  LEFT JOIN Ocupacao30d o30 ON a.IdPropriedade = o30.idpropriedade
  LEFT JOIN TarifarioAtual t ON a.IdPropriedade = t.id
  LEFT JOIN ADRHistorico h ON a.IdPropriedade = h.idPropriedade
)
SELECT *,
  ROUND(GREATEST(SAFE_DIVIDE(gap_faturamento, NULLIF(noites_para_venda_efetiva, 0)), COALESCE(preco_min_absoluto, 0)), 2) AS preco_sugerido,
  CASE
    WHEN gap_faturamento <= 0 THEN 'META ATINGIDA'
    WHEN noites_vendidas_mes >= 18 AND gap_faturamento > 0 THEN 'TETO 18 NOITES'
    WHEN noites_para_venda_efetiva = 0 AND gap_faturamento > 0 THEN 'META INATINGIVEL'
    WHEN (SAFE_DIVIDE(gap_faturamento, NULLIF(noites_para_venda_efetiva, 0))) < preco_min_absoluto THEN 'PISO MINIMO'
    ELSE 'ATUAR NO PRECO'
  END AS acao_sugerida
FROM BaseModelo
WHERE meta_mes IS NOT NULL
ORDER BY gap_faturamento DESC`

        const rows = await executeQuery<Record<string, unknown>>(sql)

        // Try to fetch basket medians from Supabase for market dimension
        const basketMedians: Record<string, number> = {}
        try {
          const supabase = getSupabaseAdmin()
          if (supabase) {
            // Get baskets for properties in result
            const propIds = rows.map(r => String(r.IdPropriedade))
            const { data: baskets } = await supabase
              .from('basket_items')
              .select('internal_property_id, basket_id')
              .eq('item_type', 'internal')
              .in('internal_property_id', propIds.slice(0, 50))

            if (baskets && baskets.length > 0) {
              const basketIds = [...new Set(baskets.map((b: Record<string, unknown>) => String(b.basket_id)))]
              // Get external items for these baskets
              const { data: externals } = await supabase
                .from('basket_items')
                .select('basket_id, airbnb_listing_id')
                .eq('item_type', 'external')
                .in('basket_id', basketIds)

              if (externals && externals.length > 0) {
                const airbnbIds = externals.map((e: Record<string, unknown>) => String(e.airbnb_listing_id)).filter(Boolean)
                if (airbnbIds.length > 0) {
                  const prefixes = airbnbIds.map(id => id.substring(0, 15))
                  // Get recent prices
                  let query = supabase
                    .from('airbnb_extrações')
                    .select('id_numerica, preco_total, quantidade_noites')
                    .gte('checkin_formatado', new Date().toISOString().split('T')[0])
                    .order('data_extracao', { ascending: false })
                    .limit(500)

                  // Filter by first prefix for efficiency
                  if (prefixes.length === 1) {
                    query = query.gte('id_numerica', prefixes[0]).lt('id_numerica', prefixes[0] + 'z')
                  }

                  const { data: prices } = await query

                  if (prices && prices.length > 0) {
                    // Group by basket → compute median
                    const basketIdToAirbnb = new Map<string, string[]>()
                    for (const ext of externals) {
                      const bId = String((ext as Record<string, unknown>).basket_id)
                      const aId = String((ext as Record<string, unknown>).airbnb_listing_id)
                      if (!basketIdToAirbnb.has(bId)) basketIdToAirbnb.set(bId, [])
                      basketIdToAirbnb.get(bId)!.push(aId)
                    }

                    const basketPrices: Record<string, number[]> = {}
                    for (const p of prices) {
                      const pr = p as Record<string, unknown>
                      const ppn = Number(pr.preco_total) / Number(pr.quantidade_noites)
                      if (!ppn || isNaN(ppn)) continue
                      const pId = String(pr.id_numerica)
                      for (const [bId, airIds] of basketIdToAirbnb) {
                        if (airIds.some(a => pId.startsWith(a.substring(0, 15)))) {
                          if (!basketPrices[bId]) basketPrices[bId] = []
                          basketPrices[bId].push(ppn)
                        }
                      }
                    }

                    // Map basket median → property
                    for (const bsk of baskets) {
                      const b = bsk as Record<string, unknown>
                      const bId = String(b.basket_id)
                      const propId = String(b.internal_property_id)
                      if (basketPrices[bId] && basketPrices[bId].length > 0) {
                        basketMedians[propId] = median(basketPrices[bId])
                      }
                    }
                  }
                }
              }
            }
          }
        } catch {
          // Supabase optional — continue without market data
        }

        // Calculate PHS for each property
        const scored = rows.map(row => {
          const vitrine = Number(row.baserate_atual || 0)
          const sugerido = Number(row.preco_sugerido || 0)
          const realizado = Number(row.realizado_mes || 0)
          const meta = Number(row.meta_mes || 0)
          const vendidas30d = Number(row.vendidas_30d || 0)
          const disponiveis30d = Number(row.disponiveis_30d || 0)
          const adrHist = Number(row.adr_historico || 0)
          const propId = String(row.IdPropriedade)
          const medianaMerc = basketMedians[propId] || 0
          const occ = (vendidas30d + disponiveis30d) > 0 ? (vendidas30d / (vendidas30d + disponiveis30d)) * 100 : 50

          const d1 = scoreD1(vitrine, sugerido)
          const d2 = scoreD2(realizado, meta)
          const d3 = scoreD3(vendidas30d, disponiveis30d)
          const d4 = scoreD4(adrHist, vitrine)
          const d5 = scoreD5(vitrine, medianaMerc, occ)
          const phs = calculatePHS(d1, d2, d3, d4, d5)
          const direction = determineDirection(vitrine, sugerido, medianaMerc, occ)

          return {
            id: propId,
            nome: row.nomePropriedade,
            praca: row.praca,
            grupo: row.grupo_nome,
            phs_score: phs,
            direction,
            d1_modelo: d1,
            d2_meta: d2,
            d3_ocupacao: d3,
            d4_historico: d4,
            d5_mercado: d5,
            vitrine: Math.round(vitrine * 100) / 100,
            sugerido: Math.round(sugerido * 100) / 100,
            mediana_mercado: medianaMerc ? Math.round(medianaMerc * 100) / 100 : null,
            gap_meta: Math.round(Number(row.gap_faturamento || 0) * 100) / 100,
            meta_mes: Math.round(meta * 100) / 100,
            realizado_mes: Math.round(realizado * 100) / 100,
            ocupacao_30d_pct: Math.round(occ * 10) / 10,
            adr_historico: adrHist ? Math.round(adrHist * 100) / 100 : null,
            noites_livres: Number(row.noites_livres_mes || 0),
            acao_sugerida: row.acao_sugerida,
          }
        })

        // Sort by PHS ascending (worst first)
        scored.sort((a, b) => a.phs_score - b.phs_score)
        const results = scored.slice(0, topN)

        const malPrecificadas = results.filter(r => r.phs_score < 50)
        const overpriced = results.filter(r => r.direction === 'OVERPRICED')
        const underpriced = results.filter(r => r.direction === 'UNDERPRICED')
        const totalGap = results.reduce((s, r) => s + Math.max(0, r.gap_meta), 0)

        const top3 = results.slice(0, 3).map(r => `${r.nome}(PHS=${r.phs_score},${r.direction})`).join(', ')

        return {
          success: true,
          data: results,
          summary: `${scored.length} propriedades analisadas. ${malPrecificadas.length} com PHS<50 (mal precificadas). ${overpriced.length} OVERPRICED, ${underpriced.length} UNDERPRICED. Gap total: R$ ${totalGap.toFixed(2)}. Top 3 criticas: ${top3}.`,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro',
          summary: 'Falha na analise de pricing health.',
        }
      }
    },
  },

  // ── 2. HISTORICAL BOOKINGS ──────────────────────
  {
    name: 'query_historical_bookings',
    description:
      'Consulta historico de reservas com filtros de lead time, dia da semana e sazonalidade. Retorna ADR mediano, range (p25-p75), volume de reservas. Essencial para estimar preco com maior probabilidade de conversao.',
    parameters: {
      property_id: { type: 'string', description: 'ID da propriedade (opcional)', required: false },
      grupo: { type: 'string', description: 'Nome do grupo/condominio (opcional)', required: false },
      praca: { type: 'string', description: 'Nome da praca (opcional)', required: false },
      property_type: { type: 'string', description: '"short-stay", "hotelaria" ou "all"', required: false, enum: ['short-stay', 'hotelaria', 'all'] },
      month: { type: 'number', description: 'Mes de checkin (1-12). Default: mes atual', required: false },
      year: { type: 'number', description: 'Ano de checkin. Default: ano anterior (para historico)', required: false },
      max_lead_time: { type: 'number', description: 'Lead time maximo em dias (default 30)', required: false },
      min_lead_time: { type: 'number', description: 'Lead time minimo em dias (default 0)', required: false },
      day_of_week: { type: 'string', description: '"weekend" (sex-dom) ou "weekday" (seg-qui). Default: todos', required: false, enum: ['weekend', 'weekday'] },
    },
    requiresConfirmation: false,
    allowedAgents: ['pricing', 'analyst', 'operations'],
    execute: async (params): Promise<ToolResult> => {
      try {
        const now = new Date()
        const month = Number(params.month) || (now.getMonth() + 1)
        const year = Number(params.year) || (now.getFullYear() - 1)
        const maxLt = Number(params.max_lead_time) || 30
        const minLt = Number(params.min_lead_time) || 0

        const tf = typeFilter(params.property_type as string)
        const pf = pracaFilter(params.praca as string)
        const propFilter = params.property_id ? `AND r.idPropriedade = '${sanitize(params.property_id)}'` : ''
        const grupoFilter = params.grupo ? `AND LOWER(p.grupo_nome) LIKE '%${sanitize(params.grupo).toLowerCase()}%'` : ''

        let dowFilter = ''
        if (params.day_of_week === 'weekend') {
          dowFilter = 'AND EXTRACT(DAYOFWEEK FROM SAFE.PARSE_DATE(\'%d-%m-%Y\', r.checkindate)) IN (1, 6, 7)' // 1=Sun, 6=Fri, 7=Sat
        } else if (params.day_of_week === 'weekday') {
          dowFilter = 'AND EXTRACT(DAYOFWEEK FROM SAFE.PARSE_DATE(\'%d-%m-%Y\', r.checkindate)) BETWEEN 2 AND 5'
        }

        const sql = `
WITH bookings AS (
  SELECT
    r.idpropriedade,
    p.nomepropriedade,
    p.praca,
    p.grupo_nome,
    r.pricepernight,
    r.reservetotal,
    r.nightcount,
    r.partnername,
    DATE_DIFF(SAFE.PARSE_DATE('%d-%m-%Y', r.checkindate), SAFE.PARSE_DATE('%d-%m-%Y', r.creationdate), DAY) AS lead_time,
    SAFE.PARSE_DATE('%d-%m-%Y', r.checkindate) AS checkin_date
  FROM warehouse.reservas_all r
  JOIN warehouse.propriedades_subgrupos p ON r.idpropriedade = p.idpropriedade
  WHERE p.Status_Aparente = 'Ativa'
    AND LOWER(r.type) NOT LIKE '%cancel%'
    AND r.buyprice != -1
    AND r.partnername != 'External API'
    AND r.pricepernight > 0
    AND EXTRACT(MONTH FROM SAFE.PARSE_DATE('%d-%m-%Y', r.checkindate)) = ${month}
    AND EXTRACT(YEAR FROM SAFE.PARSE_DATE('%d-%m-%Y', r.checkindate)) = ${year}
    AND DATE_DIFF(SAFE.PARSE_DATE('%d-%m-%Y', r.checkindate), SAFE.PARSE_DATE('%d-%m-%Y', r.creationdate), DAY) BETWEEN ${minLt} AND ${maxLt}
    ${tf} ${pf} ${propFilter} ${grupoFilter} ${dowFilter}
),
stats AS (
  SELECT
    COUNT(*) AS total_reservas,
    ROUND(AVG(pricepernight), 2) AS adr_medio,
    ROUND(MIN(pricepernight), 2) AS adr_min,
    ROUND(MAX(pricepernight), 2) AS adr_max,
    APPROX_QUANTILES(pricepernight, 4)[OFFSET(1)] AS adr_p25,
    APPROX_QUANTILES(pricepernight, 4)[OFFSET(2)] AS adr_mediana,
    APPROX_QUANTILES(pricepernight, 4)[OFFSET(3)] AS adr_p75,
    ROUND(AVG(lead_time), 1) AS lead_time_medio,
    ROUND(AVG(reservetotal), 2) AS ticket_medio,
    ROUND(AVG(nightcount), 1) AS noites_media,
    COUNT(DISTINCT idpropriedade) AS propriedades_distintas
  FROM bookings
),
by_channel AS (
  SELECT partnername AS canal,
    COUNT(*) AS reservas,
    ROUND(AVG(pricepernight), 2) AS adr_medio,
    ROUND(AVG(lead_time), 1) AS lead_time_medio
  FROM bookings
  GROUP BY 1
  ORDER BY reservas DESC
  LIMIT 5
),
by_lead_range AS (
  SELECT
    CASE
      WHEN lead_time <= 3 THEN '0-3 dias (ultima hora)'
      WHEN lead_time <= 7 THEN '4-7 dias (curto prazo)'
      WHEN lead_time <= 14 THEN '8-14 dias (medio prazo)'
      ELSE '15+ dias (antecedencia)'
    END AS faixa_lead_time,
    COUNT(*) AS reservas,
    ROUND(AVG(pricepernight), 2) AS adr_medio
  FROM bookings
  GROUP BY 1
  ORDER BY MIN(lead_time)
)
SELECT
  (SELECT TO_JSON_STRING(s) FROM stats s) AS stats_json,
  ARRAY(SELECT AS STRUCT * FROM by_channel) AS canais,
  ARRAY(SELECT AS STRUCT * FROM by_lead_range) AS faixas_lead_time`

        const rows = await executeQuery<Record<string, unknown>>(sql)
        const row = rows[0]

        if (!row) {
          return { success: true, data: { total_reservas: 0 }, summary: `Nenhuma reserva encontrada para os filtros: mes=${month}, ano=${year}, lead_time=${minLt}-${maxLt}.` }
        }

        const stats = JSON.parse(String(row.stats_json || '{}'))
        const canais = row.canais || []
        const faixas = row.faixas_lead_time || []

        const dowLabel = params.day_of_week === 'weekend' ? ' (finais de semana)' : params.day_of_week === 'weekday' ? ' (dias uteis)' : ''
        const filterLabel = [
          params.property_id ? `prop=${params.property_id}` : null,
          params.grupo ? `grupo=${params.grupo}` : null,
          params.praca ? `praca=${params.praca}` : null,
        ].filter(Boolean).join(', ') || 'portfolio geral'

        return {
          success: true,
          data: { stats, canais, faixas_lead_time: faixas },
          summary: `Historico ${month}/${year}${dowLabel} (${filterLabel}): ${stats.total_reservas || 0} reservas. ADR mediano: R$ ${stats.adr_mediana || 0}. Range P25-P75: R$ ${stats.adr_p25 || 0} — R$ ${stats.adr_p75 || 0}. Lead time medio: ${stats.lead_time_medio || 0} dias. ${stats.propriedades_distintas || 0} propriedades.`,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro',
          summary: 'Falha ao consultar historico de reservas.',
        }
      }
    },
  },

  // ── 3. PEER COMPARISON ──────────────────────────
  {
    name: 'query_peer_comparison',
    description:
      'Compara uma propriedade com seus pares no mesmo grupo/condominio. Mostra: baserate, ADR do mes, ocupacao, status, meta. Essencial para posicionamento dentro do portfolio.',
    parameters: {
      property_id: { type: 'string', description: 'ID da propriedade para comparar', required: true },
    },
    requiresConfirmation: false,
    allowedAgents: ['pricing', 'analyst'],
    execute: async (params): Promise<ToolResult> => {
      try {
        const propId = sanitize(params.property_id)
        const now = new Date()
        const mesAno = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`

        const sql = `
WITH target AS (
  SELECT IdPropriedade, nomePropriedade, praca, grupo_nome, _i_maxguests, _i_rooms
  FROM warehouse.propriedades_subgrupos
  WHERE IdPropriedade = '${propId}'
  LIMIT 1
),
peers AS (
  SELECT p.IdPropriedade, p.nomePropriedade, p.praca, p.grupo_nome, p._i_maxguests, p._i_rooms,
    CASE WHEN p.IdPropriedade = '${propId}' THEN TRUE ELSE FALSE END AS is_target
  FROM warehouse.propriedades_subgrupos p
  CROSS JOIN target t
  WHERE p.grupo_nome = t.grupo_nome AND p.Status_Aparente = 'Ativa'
),
baserate AS (
  SELECT t.id, ROUND(t.baseRateValue, 2) AS baserate_atual
  FROM stage.stays_listing_rates_sell t
  INNER JOIN (SELECT id, MAX(\`from\`) AS max_from FROM stage.stays_listing_rates_sell
    WHERE \`from\` <= CURRENT_DATE() AND baseRateValue IS NOT NULL GROUP BY id
  ) latest ON t.id = latest.id AND t.\`from\` = latest.max_from
  WHERE t.baseRateValue IS NOT NULL
),
receita AS (
  SELECT r.idPropriedade,
    SUM(r.reserveTotal) AS receita_mes,
    COUNT(*) AS reservas_mes,
    ROUND(AVG(r.pricepernight), 2) AS adr_mes
  FROM warehouse.reservas_all r
  WHERE r.type != 'canceled' AND r.buyprice != -1 AND r.partnername != 'External API'
    AND FORMAT('%02d/%d', EXTRACT(MONTH FROM SAFE.PARSE_DATE('%d-%m-%Y', r.checkOutDate)), EXTRACT(YEAR FROM SAFE.PARSE_DATE('%d-%m-%Y', r.checkOutDate))) = '${mesAno}'
  GROUP BY 1
),
occ AS (
  SELECT idpropriedade,
    COUNTIF(ocupado = 1 AND ocupado_proprietario = 0 AND manutencao = 0) AS vendidas,
    COUNTIF(ocupado = 0 AND ocupado_proprietario = 0 AND manutencao = 0) AS disponiveis
  FROM (SELECT idPropriedade, DATE(datas) AS datas, MAX(ocupado) as ocupado, MAX(ocupado_proprietario) as ocupado_proprietario, MAX(manutencao) as manutencao
    FROM stage.ocupacaoDisponibilidade_teste1
    WHERE datas >= CURRENT_DATETIME() AND datas < DATETIME_ADD(CURRENT_DATETIME(), INTERVAL 30 DAY)
    GROUP BY 1, 2)
  GROUP BY 1
),
metas AS (
  SELECT IdPropriedade, meta
  FROM stage.metas_checkout_mensais_unidade
  WHERE mes_ano = '${mesAno}'
)
SELECT
  peers.IdPropriedade AS id,
  peers.nomePropriedade AS nome,
  peers.praca,
  peers.grupo_nome AS grupo,
  peers._i_maxguests AS hospedes,
  peers._i_rooms AS quartos,
  peers.is_target,
  br.baserate_atual AS baserate,
  rec.adr_mes,
  rec.receita_mes,
  rec.reservas_mes,
  ROUND(SAFE_DIVIDE(oc.vendidas, (oc.vendidas + oc.disponiveis)) * 100, 1) AS ocupacao_30d_pct,
  mt.meta,
  ROUND(SAFE_DIVIDE(COALESCE(rec.receita_mes, 0), mt.meta) * 100, 1) AS meta_pct,
  CASE
    WHEN SAFE_DIVIDE(COALESCE(rec.receita_mes, 0), mt.meta) >= 1.0 THEN 'A'
    WHEN SAFE_DIVIDE(COALESCE(rec.receita_mes, 0), mt.meta) >= 0.8 THEN 'B'
    WHEN SAFE_DIVIDE(COALESCE(rec.receita_mes, 0), mt.meta) >= 0.6 THEN 'C'
    WHEN SAFE_DIVIDE(COALESCE(rec.receita_mes, 0), mt.meta) >= 0.4 THEN 'D'
    ELSE 'E'
  END AS status
FROM peers
LEFT JOIN baserate br ON peers.IdPropriedade = br.id
LEFT JOIN receita rec ON peers.IdPropriedade = rec.idPropriedade
LEFT JOIN occ oc ON peers.IdPropriedade = oc.idpropriedade
LEFT JOIN metas mt ON peers.IdPropriedade = mt.IdPropriedade
ORDER BY peers.is_target DESC, br.baserate_atual DESC`

        const rows = await executeQuery<Record<string, unknown>>(sql)

        if (rows.length === 0) {
          return { success: false, error: 'Propriedade nao encontrada ou sem grupo', summary: 'Nenhum peer encontrado.' }
        }

        const target = rows.find(r => r.is_target)
        const peers = rows.filter(r => !r.is_target)
        const baserates = rows.map(r => Number(r.baserate || 0)).filter(b => b > 0)
        const medianBaserate = median(baserates)

        const targetName = target ? String(target.nome) : propId
        const targetBaserate = target ? Number(target.baserate || 0) : 0

        return {
          success: true,
          data: rows,
          summary: `${targetName} (R$ ${targetBaserate.toFixed(2)}/noite) vs ${peers.length} peers no grupo "${target?.grupo || '?'}". Mediana baserate do grupo: R$ ${medianBaserate.toFixed(2)}. ${targetBaserate > medianBaserate ? `Acima da mediana em ${((targetBaserate / medianBaserate - 1) * 100).toFixed(0)}%.` : `Abaixo da mediana em ${((1 - targetBaserate / medianBaserate) * 100).toFixed(0)}%.`}`,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro',
          summary: 'Falha na comparacao entre pares.',
        }
      }
    },
  },
]
