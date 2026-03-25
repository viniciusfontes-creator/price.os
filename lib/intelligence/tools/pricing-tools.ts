// ============================================
// PRICING TOOLS
// Pricing intelligence queries
// ============================================

import type { ToolDefinition, ToolResult } from '../types'
import { executeQuery } from '@/lib/bigquery-client'

export const pricingTools: ToolDefinition[] = [
  {
    name: 'query_pricing_intelligence',
    description:
      'Consulta o modelo de pricing intelligence. Retorna preco sugerido, preco vitrine, gap de faturamento, acao sugerida para cada propriedade.',
    parameters: {
      property_id: {
        type: 'string',
        description: 'Filtrar por ID da propriedade (opcional)',
        required: false,
      },
      action_filter: {
        type: 'string',
        description: 'Filtrar por acao sugerida: ATUAR NO PRECO SUGERIDO, META ATINGIDA, TETO DE 18 NOITES, etc',
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
        description: 'Filtrar por praca (ex: "Porto de Galinhas")',
        required: false,
      },
      sort_by: {
        type: 'string',
        description: 'Ordenar por: "gap_faturamento" (padrao), "preco_sugerido", "dias_sem_venda"',
        required: false,
        enum: ['gap_faturamento', 'preco_sugerido', 'dias_sem_venda'],
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['pricing', 'analyst'],
    execute: async (params): Promise<ToolResult> => {
      try {
        // Property type and praca filters
        let typeFilter = ''
        if (params.property_type === 'short-stay') {
          typeFilter = "AND p.empreendimento_pousada IN ('Short Stay', 'Alto Padrão')"
        } else if (params.property_type === 'hotelaria') {
          typeFilter = "AND p.empreendimento_pousada = 'Empreendimento'"
        }
        let pracaFilter = ''
        if (params.praca) {
          const sanitized = String(params.praca).replace(/'/g, "''")
          pracaFilter = `AND LOWER(p.praca) LIKE '%${sanitized.toLowerCase()}%'`
        }

        const sortField = params.sort_by === 'preco_sugerido' ? 'preco_sugerido DESC'
          : params.sort_by === 'dias_sem_venda' ? 'dias_sem_venda DESC'
          : 'gap_faturamento DESC'

        // Full pricing intelligence query (same as SQL_PRICING_INTELLIGENCE in bigquery-service.ts)
        const sql = `
WITH LeadTimeDinamico AS (
    SELECT p.praca,
        CAST(ROUND(AVG(DATE_DIFF(SAFE.PARSE_DATE('%d-%m-%Y', r.checkInDate), SAFE.PARSE_DATE('%d-%m-%Y', r.creationDate), DAY)), 0) AS INT64) AS lead_time_momento
    FROM warehouse.propriedades_subgrupos p
    JOIN warehouse.reservas_all r ON p.IdPropriedade = r.idPropriedade
    WHERE r.type != 'canceled' AND SAFE.PARSE_DATE('%d-%m-%Y', r.creationDate) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY 1
),
AnaliseProjetada AS (
    SELECT p.IdPropriedade, p.nomePropriedade, p.praca,
        COALESCE(ltd.lead_time_momento, 0) AS lead_time_momento,
        EXTRACT(MONTH FROM DATE_ADD(CURRENT_DATE(), INTERVAL COALESCE(ltd.lead_time_momento,0) DAY)) AS mes_alvo,
        EXTRACT(YEAR FROM DATE_ADD(CURRENT_DATE(), INTERVAL COALESCE(ltd.lead_time_momento,0) DAY)) AS ano_alvo
    FROM warehouse.propriedades_subgrupos p
    LEFT JOIN LeadTimeDinamico ltd ON p.praca = ltd.praca
    WHERE p.Status_Aparente = 'Ativa'
    ${typeFilter}
    ${pracaFilter}
),
OcupacaoMes AS (
    SELECT idpropriedade, EXTRACT(MONTH FROM datas) AS mes, EXTRACT(YEAR FROM datas) AS ano,
        COUNTIF(ocupado = 1 AND ocupado_proprietario = 0 AND manutencao = 0) AS noites_vendidas,
        COUNTIF(ocupado = 0 AND ocupado_proprietario = 0 AND manutencao = 0) AS noites_livres
    FROM (SELECT idPropriedade, DATE(datas) AS datas, MAX(ocupado) as ocupado, MAX(ocupado_proprietario) as ocupado_proprietario, MAX(manutencao) as manutencao
        FROM stage.ocupacaoDisponibilidade_teste1 GROUP BY 1, 2)
    GROUP BY 1,2,3
),
FinanceiroMes AS (
    SELECT r.idPropriedade, EXTRACT(MONTH FROM SAFE.PARSE_DATE('%d-%m-%Y', r.checkOutDate)) AS mes,
        EXTRACT(YEAR FROM SAFE.PARSE_DATE('%d-%m-%Y', r.checkOutDate)) AS ano, SUM(r.reserveTotal) AS faturamento_realizado
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
UltimaVenda AS (
    SELECT idPropriedade, MAX(SAFE.PARSE_DATE('%d-%m-%Y', creationDate)) AS data_ultima_venda
    FROM warehouse.reservas_all WHERE type != 'canceled' GROUP BY 1
),
BaseModelo AS (
    SELECT a.IdPropriedade, a.nomePropriedade, a.praca, a.lead_time_momento, a.mes_alvo, a.ano_alvo,
        m.meta AS meta_mes, COALESCE(f.faturamento_realizado,0) AS realizado_mes,
        (m.meta - COALESCE(f.faturamento_realizado,0)) AS gap_faturamento,
        COALESCE(o.noites_vendidas, 0) AS noites_vendidas, COALESCE(o.noites_livres, 0) AS noites_livres,
        GREATEST(18 - COALESCE(o.noites_vendidas, 0), 0) AS noites_restantes_no_teto,
        SAFE_DIVIDE(m.meta, 20) AS preco_min_absoluto, t.baserate_atual, u.data_ultima_venda,
        DATE_DIFF(CURRENT_DATE(), u.data_ultima_venda, DAY) AS dias_sem_venda
    FROM AnaliseProjetada a
    JOIN stage.metas_checkout_mensais_unidade m ON a.IdPropriedade = m.IdPropriedade AND m.mes_ano = FORMAT('%02d/%d', a.mes_alvo, a.ano_alvo)
    LEFT JOIN FinanceiroMes f ON a.IdPropriedade = f.idPropriedade AND f.mes = a.mes_alvo AND f.ano = a.ano_alvo
    LEFT JOIN OcupacaoMes o ON a.IdPropriedade = o.idpropriedade AND o.mes = a.mes_alvo AND o.ano = a.ano_alvo
    LEFT JOIN TarifarioAtual t ON a.IdPropriedade = t.id
    LEFT JOIN UltimaVenda u ON a.IdPropriedade = u.idPropriedade
),
PrecoCalculado AS (
    SELECT *, LEAST(noites_livres, noites_restantes_no_teto) AS noites_para_venda_efetiva FROM BaseModelo
)
SELECT IdPropriedade, nomePropriedade, praca, lead_time_momento, mes_alvo, ano_alvo, meta_mes, realizado_mes, gap_faturamento,
    noites_vendidas, noites_livres, noites_para_venda_efetiva, preco_min_absoluto,
    ROUND(GREATEST(SAFE_DIVIDE(gap_faturamento, NULLIF(noites_para_venda_efetiva, 0)), preco_min_absoluto), 2) AS preco_sugerido,
    baserate_atual AS preco_vitrine_hoje, data_ultima_venda, dias_sem_venda,
    CASE
        WHEN gap_faturamento <= 0 THEN 'META ATINGIDA'
        WHEN noites_vendidas >= 18 AND gap_faturamento > 0 THEN 'TETO DE 18 NOITES ATINGIDO - MANTER ADR ALTO'
        WHEN noites_para_venda_efetiva = 0 AND gap_faturamento > 0 THEN 'META INATINGIVEL - SEM CALENDARIO'
        WHEN (SAFE_DIVIDE(gap_faturamento, NULLIF(noites_para_venda_efetiva, 0))) < preco_min_absoluto THEN 'PRECO NO PISO MINIMO (DIV 20)'
        ELSE 'ATUAR NO PRECO SUGERIDO (TETO 18 NOITES)'
    END AS acao_sugerida
FROM PrecoCalculado
${params.property_id ? `WHERE IdPropriedade = '${String(params.property_id).replace(/'/g, "''")}'` : ''}
ORDER BY ${sortField}`

        let rows = await executeQuery<Record<string, unknown>>(sql)

        if (params.action_filter) {
          const filter = String(params.action_filter).toUpperCase()
          rows = rows.filter((r) => String(r.acao_sugerida || '').includes(filter))
        }

        // Build summary with action distribution
        const actionCounts: Record<string, number> = {}
        let totalGap = 0
        for (const r of rows) {
          const action = String(r.acao_sugerida || 'DESCONHECIDA')
          actionCounts[action] = (actionCounts[action] || 0) + 1
          totalGap += Number(r.gap_faturamento || 0)
        }
        const actionSummary = Object.entries(actionCounts).map(([a, c]) => `${a}: ${c}`).join(', ')

        return {
          success: true,
          data: rows.slice(0, 100),
          summary: `Pricing intelligence: ${rows.length} propriedades analisadas. Gap total: R$ ${totalGap.toFixed(2)}. Distribuicao: ${actionSummary}.${rows.length > 100 ? ' (mostrando top 100)' : ''}`,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro',
          summary: 'Falha ao consultar pricing intelligence.',
        }
      }
    },
  },
  {
    name: 'analyze_price_position',
    description:
      'Analisa posicionamento de preco de uma propriedade vs tarifario atual e preco sugerido.',
    parameters: {
      property_id: {
        type: 'string',
        description: 'ID da propriedade',
        required: true,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['pricing', 'market'],
    execute: async (params): Promise<ToolResult> => {
      try {
        const propId = String(params.property_id).replace(/'/g, "''")

        const sql = `
SELECT
  id AS idpropriedade,
  \`from\` AS data_inicio,
  \`to\` AS data_fim,
  ROUND(baseratevalue, 2) AS baserate
FROM \`stage.stays_listing_rates_sell\`
WHERE id = '${propId}'
  AND EXTRACT(YEAR FROM \`from\`) >= EXTRACT(YEAR FROM CURRENT_DATE())
ORDER BY \`from\` ASC`

        const rows = await executeQuery(sql)
        return {
          success: true,
          data: rows,
          summary: `Tarifario da propriedade ${params.property_id}: ${rows.length} faixas de preco.`,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro',
          summary: 'Falha ao analisar posicionamento de preco.',
        }
      }
    },
  },
  {
    name: 'suggest_price_adjustment',
    description:
      'RECOMENDACAO: Analisa e sugere ajuste de preco para uma propriedade baseado no modelo de pricing intelligence. NAO executa alteracoes - apenas gera recomendacao.',
    parameters: {
      property_id: {
        type: 'string',
        description: 'ID da propriedade para analisar',
        required: true,
      },
    },
    requiresConfirmation: true,
    allowedAgents: ['pricing'],
    execute: async (params): Promise<ToolResult> => {
      // This tool is flagged as requiresConfirmation
      // In Phase 1, it only generates a recommendation (no write)
      try {
        const propId = String(params.property_id).replace(/'/g, "''")

        const sql = `
WITH pricing AS (
  SELECT IdPropriedade, nomePropriedade, praca, meta_mes, realizado_mes, gap_faturamento,
    noites_vendidas, noites_livres, noites_para_venda_efetiva, preco_min_absoluto,
    ROUND(GREATEST(SAFE_DIVIDE(gap_faturamento, NULLIF(noites_para_venda_efetiva, 0)), preco_min_absoluto), 2) AS preco_sugerido,
    baserate_atual AS preco_atual, dias_sem_venda
  FROM (
    SELECT a.IdPropriedade, a.nomePropriedade, a.praca, a.mes_alvo, a.ano_alvo,
      m.meta AS meta_mes, COALESCE(f.faturamento_realizado,0) AS realizado_mes,
      (m.meta - COALESCE(f.faturamento_realizado,0)) AS gap_faturamento,
      COALESCE(o.noites_vendidas, 0) AS noites_vendidas, COALESCE(o.noites_livres, 0) AS noites_livres,
      LEAST(COALESCE(o.noites_livres, 0), GREATEST(18 - COALESCE(o.noites_vendidas, 0), 0)) AS noites_para_venda_efetiva,
      SAFE_DIVIDE(m.meta, 20) AS preco_min_absoluto, t.baserate_atual,
      DATE_DIFF(CURRENT_DATE(), u.data_ultima_venda, DAY) AS dias_sem_venda
    FROM (
      SELECT p.IdPropriedade, p.nomePropriedade, p.praca,
        EXTRACT(MONTH FROM DATE_ADD(CURRENT_DATE(), INTERVAL COALESCE(ltd.lead_time_momento,0) DAY)) AS mes_alvo,
        EXTRACT(YEAR FROM DATE_ADD(CURRENT_DATE(), INTERVAL COALESCE(ltd.lead_time_momento,0) DAY)) AS ano_alvo
      FROM warehouse.propriedades_subgrupos p
      LEFT JOIN (SELECT praca, CAST(ROUND(AVG(DATE_DIFF(SAFE.PARSE_DATE('%d-%m-%Y', checkInDate), SAFE.PARSE_DATE('%d-%m-%Y', creationDate), DAY)),0) AS INT64) AS lead_time_momento
        FROM warehouse.propriedades_subgrupos pp JOIN warehouse.reservas_all rr ON pp.IdPropriedade = rr.idPropriedade
        WHERE rr.type != 'canceled' AND SAFE.PARSE_DATE('%d-%m-%Y', rr.creationDate) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) GROUP BY 1
      ) ltd ON p.praca = ltd.praca
      WHERE p.IdPropriedade = '${propId}'
    ) a
    JOIN stage.metas_checkout_mensais_unidade m ON a.IdPropriedade = m.IdPropriedade AND m.mes_ano = FORMAT('%02d/%d', a.mes_alvo, a.ano_alvo)
    LEFT JOIN (SELECT idPropriedade, EXTRACT(MONTH FROM SAFE.PARSE_DATE('%d-%m-%Y', checkOutDate)) AS mes, EXTRACT(YEAR FROM SAFE.PARSE_DATE('%d-%m-%Y', checkOutDate)) AS ano, SUM(reserveTotal) AS faturamento_realizado FROM warehouse.reservas_all WHERE type != 'canceled' GROUP BY 1,2,3) f ON a.IdPropriedade = f.idPropriedade AND f.mes = a.mes_alvo AND f.ano = a.ano_alvo
    LEFT JOIN (SELECT idpropriedade, EXTRACT(MONTH FROM datas) AS mes, EXTRACT(YEAR FROM datas) AS ano, COUNTIF(ocupado = 1 AND ocupado_proprietario = 0 AND manutencao = 0) AS noites_vendidas, COUNTIF(ocupado = 0 AND ocupado_proprietario = 0 AND manutencao = 0) AS noites_livres FROM (SELECT idPropriedade, DATE(datas) AS datas, MAX(ocupado) as ocupado, MAX(ocupado_proprietario) as ocupado_proprietario, MAX(manutencao) as manutencao FROM stage.ocupacaoDisponibilidade_teste1 GROUP BY 1, 2) GROUP BY 1,2,3) o ON a.IdPropriedade = o.idpropriedade AND o.mes = a.mes_alvo AND o.ano = a.ano_alvo
    LEFT JOIN (SELECT t.id, ROUND(t.baseRateValue, 2) AS baserate_atual FROM stage.stays_listing_rates_sell t INNER JOIN (SELECT id, MAX(\`from\`) AS max_from FROM stage.stays_listing_rates_sell WHERE \`from\` <= CURRENT_DATE() AND baseRateValue IS NOT NULL GROUP BY id) latest ON t.id = latest.id AND t.\`from\` = latest.max_from WHERE t.baseRateValue IS NOT NULL) t ON a.IdPropriedade = t.id
    LEFT JOIN (SELECT idPropriedade, MAX(SAFE.PARSE_DATE('%d-%m-%Y', creationDate)) AS data_ultima_venda FROM warehouse.reservas_all WHERE type != 'canceled' GROUP BY 1) u ON a.IdPropriedade = u.idPropriedade
  )
)
SELECT * FROM pricing`

        const rows = await executeQuery<Record<string, unknown>>(sql)
        const row = rows[0]

        if (!row) {
          return { success: false, error: 'Propriedade nao encontrada', summary: 'Propriedade nao encontrada no modelo de pricing.' }
        }

        return {
          success: true,
          data: row,
          summary: `Recomendacao para ${row.nomePropriedade}: Preco atual R$ ${Number(row.preco_atual || 0).toFixed(2)}, sugerido R$ ${Number(row.preco_sugerido || 0).toFixed(2)}. Gap: R$ ${Number(row.gap_faturamento || 0).toFixed(2)}.`,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro',
          summary: 'Falha ao gerar sugestao de preco.',
        }
      }
    },
  },
]
