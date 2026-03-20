/**
 * BigQuery Data Service
 * 
 * This service provides typed access to BigQuery data using the SQL queries
 * provided by the user. All queries are executed server-side only.
 */

import { executeQuery } from './bigquery-client'
import { calculatePropertyStatus } from '@/lib/calculations'
import type {
    WebhookPropriedade,
    WebhookReserva,
    WebhookMeta,
    SalesGoals,
    IntegratedData,
    PropriedadeMetricas,
    TarifarioFaixa,
    BQDiscount
} from '@/types'

// ============================================
// TYPES FOR BIGQUERY RESULTS
// ============================================

export interface BQPropriedade {
    idpropriedade: string
    nomepropriedade: string
    name: string | null
    _i_maxguests: number | null
    nome_externo: string | null
    cidade: string | null
    estado: string | null
    latitude: number | null
    longitude: number | null
    _i_rooms: number | null
    pricemaster: number | null
    grupo_nome: string
    praca: string
    empreendimento_pousada: string
    sub_grupo: string
    baserate_atual: number | null
}

export interface BQReserva {
    idpropriedade: string
    companycommision: number
    buyprice: number
    reservetotal: number
    checkoutdate: string // DATE as string YYYY-MM-DD
    creationdate: string // DATE as string YYYY-MM-DD
    checkindate: string // DATE as string YYYY-MM-DD
    antecedencia_reserva: number
    guesttotalcount: number
    nightcount: number
    pricepernight: number
    partnername: string
    agentname: string
}

export interface BQMetaCheckout {
    idpropriedade: string // alias from query
    mes_ano: string // mm/yyyy format
    meta: number
    Base_ou_Nova: string // "Base" or "Nova"
}

export interface BQTarifario {
    idpropriedade: string
    from: { value: string } // BigQuery DATE returns {value: "YYYY-MM-DD"}
    to: string              // STRING in YYYY-MM-DD
    baserate: number | null
}
export interface BQPricingIntelligence {
    IdPropriedade: string
    nomePropriedade: string
    praca: string
    lead_time_momento: number
    mes_alvo: number
    ano_alvo: number
    meta_mes: number
    realizado_mes: number
    gap_faturamento: number
    noites_vendidas: number
    noites_livres: number
    noites_para_venda_efetiva: number
    preco_min_absoluto: number
    preco_sugerido: number
    preco_vitrine_hoje: number
    data_ultima_venda: string | null
    dias_sem_venda: number | null
    acao_sugerida: string
}

export interface BQMetaCriacao {
    IdPropriedade: string
    Mes: number
    Meta: number
    semana_numero: number
    data_inicio_semana: string // DATE
    data_fim_semana: string // DATE
    meta_semanal: number
}

export interface BQOcupacao {
    idpropriedade: string
    datas: string // YYYY-MM-DD
    idreserva: string | null
    ocupado: number // 0 ou 1
    ocupado_proprietario: number // 0 ou 1
    manutencao: number // 0 ou 1
    disponivel: number // 0 ou 1
}

export interface BQAirbnbCompetitor {
    id: number
    data_extracao: string
    tipo_propriedade: string
    nome_anuncio: string
    preco_total: number
    quantidade_noites: number
    preco_por_noite: number
    latitude: number
    longitude: number
    cidade: string
    regiao: string
    estado: string
    hospedes_adultos: number
    media_avaliacao: string
    preferido_hospedes: boolean
}

// ============================================
// SQL QUERIES (from user specifications)
// ============================================

function getSqlPropriedades(viewContext?: string): string {
    let filter = "p.status_aparente = 'Ativa'"

    if (viewContext === 'short-stay') {
        filter += " AND p.empreendimento_pousada IN ('Short Stay', 'Alto Padrão')"
    } else if (viewContext === 'hotelaria') {
        filter += " AND p.empreendimento_pousada = 'Empreendimento'"
    }

    return `
SELECT
  p.idpropriedade,
  p.name,
  p.nomepropriedade,
  p._i_maxguests,
  p.nome_externo,
  p.cidade,
  p.estado,
  p.latitude,
  p.longitude,
  p._i_rooms,
  p.pricemaster,
  p.grupo_nome,
  p.praca,
  p.empreendimento_pousada,
  p.sub_grupo,
  t.baserate_atual
FROM
  \`warehouse.propriedades_subgrupos\` p
LEFT JOIN (
  SELECT id, ROUND(AVG(baseratevalue),2) AS baserate_atual FROM \`stage.stays_listing_rates_sell\` GROUP BY 1
) t ON p.idpropriedade = t.id
WHERE
  ${filter}
`
}

const SQL_RESERVAS = `
SELECT
  CAST(idpropriedade AS STRING) AS idpropriedade,
  CAST(companycommision AS NUMERIC) AS companycommision,
  CAST(buyprice AS NUMERIC) AS buyprice,
  CAST(reservetotal AS NUMERIC) AS reservetotal,
  FORMAT_DATE('%Y-%m-%d', SAFE.PARSE_DATE('%d-%m-%Y', checkoutdate)) AS checkoutdate,
  FORMAT_DATE('%Y-%m-%d', SAFE.PARSE_DATE('%d-%m-%Y', creationdate)) AS creationdate,
  FORMAT_DATE('%Y-%m-%d', SAFE.PARSE_DATE('%d-%m-%Y', checkindate)) AS checkindate,
  CAST(
    GREATEST(
      DATE_DIFF(
        SAFE.PARSE_DATE('%d-%m-%Y', checkindate),
        SAFE.PARSE_DATE('%d-%m-%Y', creationdate),
        DAY
      ),
      0
    ) AS INT64
  ) AS antecedencia_reserva,
  CAST(guesttotalcount AS INT64) AS guesttotalcount,
  CAST(nightcount AS INT64) AS nightcount,
  CAST(pricepernight AS NUMERIC) AS pricepernight,
  CAST(
    CASE
      WHEN LOWER(partnername) LIKE '%curta%' THEN 'CurtaBora'
      WHEN partnername IN ('Atendimento', 'Atendimento Host') THEN 'Atendimento'
      ELSE partnername
    END AS STRING
  ) AS partnername,
  CAST(agentName AS STRING) AS agentname
FROM
  \`warehouse.reservas_all\`
WHERE
  partnername <> 'External API'
  AND buyprice > 0
  AND reservetotal > 0
  AND LOWER(type) NOT LIKE '%canceled%'
`

const SQL_METAS_CHECKOUT = `
SELECT
  IdPropriedade as idpropriedade,
  mes_ano,
  SAFE_CAST(meta AS NUMERIC) AS meta,
  Base_ou_Nova
FROM
  \`stage.metas_checkout_mensais_unidade\`
WHERE
  EXTRACT(YEAR FROM PARSE_DATE('%m/%Y', mes_ano)) = EXTRACT(YEAR FROM CURRENT_DATE())
ORDER BY
  idpropriedade, mes_ano
`

const SQL_TARIFARIO = `
SELECT
  id AS idpropriedade,
  \`from\`,
  \`to\`,
  ROUND(baseratevalue, 2) AS baserate
FROM \`stage.stays_listing_rates_sell\`
WHERE EXTRACT(YEAR FROM \`from\`) >= EXTRACT(YEAR FROM CURRENT_DATE()) - 1
ORDER BY id, DATE_DIFF(SAFE_CAST(\`to\` AS DATE), SAFE_CAST(\`from\` AS DATE), DAY) ASC
`

const SQL_DISCOUNTS = `
SELECT
  property_code AS idpropriedade,
  date,
  discount_percent,
  is_rise
FROM \`stage.stays_discounts_calendar\`
WHERE SAFE_CAST(date AS DATE) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
ORDER BY idpropriedade, date
`

const SQL_METAS_CRIACAO = `
SELECT 
    IdPropriedade,
    Mes,
    Meta,
    semana_numero,
    data_inicio_semana,
    data_fim_semana,
    ROUND(Meta / 4, 2) as meta_semanal
FROM \`stage.metas_mensais_unidade\`
CROSS JOIN UNNEST([
    STRUCT(1 as semana_numero, DATE(EXTRACT(YEAR FROM CURRENT_DATE()), Mes, 1) as data_inicio_semana, DATE(EXTRACT(YEAR FROM CURRENT_DATE()), Mes, 7) as data_fim_semana),
    STRUCT(2, DATE(EXTRACT(YEAR FROM CURRENT_DATE()), Mes, 8), DATE(EXTRACT(YEAR FROM CURRENT_DATE()), Mes, 14)),
    STRUCT(3, DATE(EXTRACT(YEAR FROM CURRENT_DATE()), Mes, 15), DATE(EXTRACT(YEAR FROM CURRENT_DATE()), Mes, 21)),
    STRUCT(4, DATE(EXTRACT(YEAR FROM CURRENT_DATE()), Mes, 22), LAST_DAY(DATE(EXTRACT(YEAR FROM CURRENT_DATE()), Mes, 1)))
])
WHERE Mes = EXTRACT(MONTH FROM CURRENT_DATE())
ORDER BY IdPropriedade, semana_numero
`

const SQL_OCUPACAO = `
SELECT
  idPropriedade as idpropriedade,
  FORMAT_DATE('%Y-%m-%d', DATE(datas)) as datas,
  MAX(idReserva) as idreserva,
  MAX(CAST(ocupado AS INT64)) as ocupado,
  MAX(CAST(ocupado_proprietario AS INT64)) as ocupado_proprietario,
  MAX(CAST(manutencao AS INT64)) as manutencao,
  MAX(CAST(disponivel AS INT64)) as disponivel
FROM
  \`stage.ocupacaoDisponibilidade_teste1\`
WHERE
  DATE(datas) BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY 1, 2
`

const SQL_PRICING_INTELLIGENCE = `
WITH LeadTimeDinamico AS (
    SELECT
        p.praca,
        CAST(ROUND(AVG(DATE_DIFF(SAFE.PARSE_DATE('%d-%m-%Y', r.checkInDate), SAFE.PARSE_DATE('%d-%m-%Y', r.creationDate), DAY)), 0) AS INT64) AS lead_time_momento
    FROM warehouse.propriedades_subgrupos p
    JOIN warehouse.reservas_all r ON p.IdPropriedade = r.idPropriedade
    WHERE r.type != 'canceled' AND SAFE.PARSE_DATE('%d-%m-%Y', r.creationDate) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY 1
),
AnaliseProjetada AS (
    SELECT
        p.IdPropriedade, p.nomePropriedade, p.praca,
        COALESCE(ltd.lead_time_momento, 0) AS lead_time_momento,
        EXTRACT(MONTH FROM DATE_ADD(CURRENT_DATE(), INTERVAL COALESCE(ltd.lead_time_momento,0) DAY)) AS mes_alvo,
        EXTRACT(YEAR FROM DATE_ADD(CURRENT_DATE(), INTERVAL COALESCE(ltd.lead_time_momento,0) DAY)) AS ano_alvo
    FROM warehouse.propriedades_subgrupos p
    LEFT JOIN LeadTimeDinamico ltd ON p.praca = ltd.praca
    WHERE p.Status_Aparente = 'Ativa'
),
OcupacaoMes AS (
    SELECT idpropriedade, EXTRACT(MONTH FROM datas) AS mes, EXTRACT(YEAR FROM datas) AS ano,
        COUNTIF(ocupado = 1 AND ocupado_proprietario = 0 AND manutencao = 0) AS noites_vendidas,
        COUNTIF(ocupado = 0 AND ocupado_proprietario = 0 AND manutencao = 0) AS noites_livres
    FROM (
        SELECT idPropriedade, DATE(datas) AS datas, MAX(ocupado) as ocupado, MAX(ocupado_proprietario) as ocupado_proprietario, MAX(manutencao) as manutencao
        FROM stage.ocupacaoDisponibilidade_teste1
        GROUP BY 1, 2
    )
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
    INNER JOIN (
        SELECT id, MAX(\`from\`) AS max_from
        FROM stage.stays_listing_rates_sell
        WHERE \`from\` <= CURRENT_DATE() AND baseRateValue IS NOT NULL
        GROUP BY id
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
ORDER BY IdPropriedade
`

const SQL_AIRBNB_COMPETITORS = `
SELECT
  id,
  data_extracao,
  tipo_propriedade,
  nome_anuncio,
  preco_total,
  CAST(quantidade_noites AS INT64) AS quantidade_noites,
  SAFE_DIVIDE(preco_total, NULLIF(CAST(quantidade_noites AS INT64), 0)) AS preco_por_noite,
  latitude,
  longitude,
  cidade,
  regiao,
  estado,
  hospedes_adultos,
  media_avaliacao,
  preferido_hospedes
FROM
  \`stage.airbnb_extrações\`
WHERE
  preco_total IS NOT NULL
  AND CAST(quantidade_noites AS INT64) > 0
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL
ORDER BY
  data_extracao DESC
`

// ============================================
// DATA FETCHING FUNCTIONS
// ============================================

export async function getPropriedades(viewContext?: string): Promise<BQPropriedade[]> {
    return executeQuery<BQPropriedade>(getSqlPropriedades(viewContext))
}

export async function getReservas(): Promise<BQReserva[]> {
    return executeQuery<BQReserva>(SQL_RESERVAS)
}

export async function getMetasCheckout(): Promise<BQMetaCheckout[]> {
    return executeQuery<BQMetaCheckout>(SQL_METAS_CHECKOUT)
}

export async function getTarifario(): Promise<BQTarifario[]> {
    return executeQuery<BQTarifario>(SQL_TARIFARIO)
}

export async function getDiscounts(): Promise<BQDiscount[]> {
    return executeQuery<BQDiscount>(SQL_DISCOUNTS)
}

export async function getMetasCriacao(): Promise<BQMetaCriacao[]> {
    return executeQuery<BQMetaCriacao>(SQL_METAS_CRIACAO)
}

export async function getOcupacao(): Promise<BQOcupacao[]> {
    return executeQuery<BQOcupacao>(SQL_OCUPACAO)
}

export async function getPricingIntelligence(): Promise<BQPricingIntelligence[]> {
    return executeQuery<BQPricingIntelligence>(SQL_PRICING_INTELLIGENCE)
}

export async function getAirbnbCompetitors(): Promise<BQAirbnbCompetitor[]> {
    return executeQuery<BQAirbnbCompetitor>(SQL_AIRBNB_COMPETITORS)
}

// ============================================
// DATA TRANSFORMATION FUNCTIONS
// ============================================

function convertToNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0
    const parsed = Number.parseFloat(String(value).replace(/[^\d.-]/g, ''))
    return isNaN(parsed) ? 0 : Number(parsed.toFixed(2))
}

function transformBQPropriedade(bq: BQPropriedade): WebhookPropriedade {
    return {
        idpropriedade: bq.idpropriedade,
        nomepropriedade: bq.nomepropriedade,
        grupo_nome: bq.grupo_nome,
        praca: bq.praca,
        empreendimento_pousada: bq.empreendimento_pousada,
        sub_grupo: bq.sub_grupo,
        nome_externo: bq.nome_externo || undefined,
        longitude: bq.longitude || undefined,
        latitude: bq.latitude || undefined,
        _i_maxguests: bq._i_maxguests || undefined,
        valor_tarifario: bq.baserate_atual || undefined,
        valor_stays: bq.pricemaster || undefined,
    }
}

function transformBQReserva(bq: BQReserva): WebhookReserva {
    return {
        idpropriedade: bq.idpropriedade,
        companycommision: convertToNumber(bq.companycommision),
        buyprice: convertToNumber(bq.buyprice),
        reservetotal: convertToNumber(bq.reservetotal),
        checkoutdate: bq.checkoutdate,
        creationdate: bq.creationdate,
        checkindate: bq.checkindate,
        antecedencia_reserva: bq.antecedencia_reserva,
        guesttotalcount: bq.guesttotalcount,
        nightcount: bq.nightcount,
        pricepernight: convertToNumber(bq.pricepernight),
        partnername: bq.partnername,
        agentname: bq.agentname,
    }
}

function transformBQMeta(bq: BQMetaCheckout): WebhookMeta {
    // Extract month and year from mes_ano (mm/yyyy format)
    const parts = (bq.mes_ano || '').split('/')
    let month = '01', year = '2024'
    let monthNumber = 1

    if (parts.length === 2) {
        month = parts[0]
        year = parts[1]
        monthNumber = parseInt(month, 10)
    }
    const dataEspecifica = `${year}-${month}-01`

    return {
        IdPropriedade: bq.idpropriedade,
        data_especifica: dataEspecifica,
        meta: convertToNumber(bq.meta),
        meta_movel: 0,
        mes: monthNumber,
    }
}

function calculateMetrics(
    reservas: WebhookReserva[],
    metas: WebhookMeta[],
    ocupacao: BQOcupacao[] = []
): PropriedadeMetricas {
    if (reservas.length === 0) {
        return {
            totalReservas: 0,
            receitaTotal: 0,
            ticketMedio: 0,
            hospedesTotais: 0,
            diariasVendidas: 0,
            precoMedioNoite: 0,
            antecedenciaMedia: 0,
            metaMensal: 0,
            metaMovel: 0,
            receitaCheckoutMes: 0,
            status: 'E',
        }
    }

    const totals = reservas.reduce(
        (acc, r) => ({
            receita: acc.receita + convertToNumber(r.reservetotal),
            hospedes: acc.hospedes + convertToNumber(r.guesttotalcount),
            diarias: acc.diarias + convertToNumber(r.nightcount),
            antecedencia: acc.antecedencia + convertToNumber(r.antecedencia_reserva),
            preco: acc.preco + convertToNumber(r.pricepernight),
        }),
        { receita: 0, hospedes: 0, diarias: 0, antecedencia: 0, preco: 0 }
    )

    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    const inicioMesStr = inicioMes.toISOString().split('T')[0]
    const fimMesStr = fimMes.toISOString().split('T')[0]
    const anoMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    const todayStr = hoje.toISOString().split('T')[0]

    // Calculate TARGET MONTH (Today + Lead Time)
    const antecedenciaMedia = reservas.length > 0
        ? reservas.reduce((sum, r) => sum + convertToNumber(r.antecedencia_reserva), 0) / reservas.length : 28
    const targetDate = new Date(hoje)
    targetDate.setDate(targetDate.getDate() + Math.round(antecedenciaMedia))
    const targetMonthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`

    const ocupacaoTargetMonth = ocupacao.filter(o => o.datas.startsWith(targetMonthStr))
    const noitesOcupadasTarget = ocupacaoTargetMonth.filter(o => o.ocupado === 1).length

    // Fallback: Nights sold by reservations created this month
    const diariasMTDReservas = reservas
        .filter(r => r.creationdate >= inicioMesStr && r.creationdate <= todayStr)
        .reduce((sum, r) => sum + convertToNumber(r.nightcount), 0)

    const diariasVendidas = ocupacaoTargetMonth.length > 0 ? noitesOcupadasTarget : diariasMTDReservas

    const totalReservas = reservas.length
    const receitaCheckoutMes = reservas
        .filter((r) => r.checkoutdate >= inicioMesStr && r.checkoutdate <= fimMesStr)
        .reduce((sum, r) => sum + convertToNumber(r.reservetotal), 0)

    const metaMensal = metas
        .filter((meta) => String(meta.data_especifica || '').startsWith(anoMes))
        .reduce((sum, meta) => sum + convertToNumber(meta.meta), 0)

    const metaMovel = metas
        .filter((meta) => String(meta.data_especifica || '').startsWith(anoMes))
        .reduce((sum, meta) => sum + convertToNumber(meta.meta_movel), 0)

    const status = calculatePropertyStatus(receitaCheckoutMes, metaMensal, metaMovel)

    return {
        totalReservas,
        receitaTotal: Number(totals.receita.toFixed(2)),
        ticketMedio: Number((totals.receita / totalReservas).toFixed(2)),
        hospedesTotais: totals.hospedes,
        diariasVendidas: diariasVendidas,
        precoMedioNoite: Number((totals.preco / totalReservas).toFixed(2)),
        antecedenciaMedia: Number((totals.antecedencia / totalReservas).toFixed(2)),
        metaMensal: Number(metaMensal.toFixed(2)),
        metaMovel: Number(metaMovel.toFixed(2)),
        receitaCheckoutMes: Number(receitaCheckoutMes.toFixed(2)),
        status,
    }
}

// ============================================
export async function getIntegratedDataFromBigQuery(viewContext?: string): Promise<IntegratedData[]> {
    const [bqPropriedades, bqReservas, bqMetas, bqMetasCriacao, bqOcupacao, bqTarifario, bqDiscounts] = await Promise.all([
        getPropriedades(viewContext),
        getReservas(),
        getMetasCheckout(),
        getMetasCriacao(),
        getOcupacao(),
        getTarifario(),
        getDiscounts()
    ])

    // Create maps for fast lookup
    const reservasByProp = new Map<string, WebhookReserva[]>()
    bqReservas.forEach((r) => {
        const transformed = transformBQReserva(r)
        if (!reservasByProp.has(r.idpropriedade)) {
            reservasByProp.set(r.idpropriedade, [])
        }
        reservasByProp.get(r.idpropriedade)!.push(transformed)
    })

    const metasByProp = new Map<string, WebhookMeta[]>()
    bqMetas.forEach((m) => {
        const transformed = transformBQMeta(m)
        if (!metasByProp.has(m.idpropriedade)) {
            metasByProp.set(m.idpropriedade, [])
        }
        metasByProp.get(m.idpropriedade)!.push(transformed)
    })

    // Create sales goals from metas_criacao
    const salesGoalsByProp = new Map<string, SalesGoals>()
    bqMetasCriacao.forEach((mc) => {
        if (!salesGoalsByProp.has(mc.IdPropriedade)) {
            salesGoalsByProp.set(mc.IdPropriedade, {
                IdPropriedade: mc.IdPropriedade,
                mcriacao_semanal: mc.meta_semanal,
                mvenda_mensal: mc.Meta,
            })
        }
    })

    // Group tarifario by property
    const tarifarioByProp = new Map<string, TarifarioFaixa[]>()
    bqTarifario.forEach((t) => {
        if (t.baserate == null) return // Skip null rates
        if (!tarifarioByProp.has(t.idpropriedade)) {
            tarifarioByProp.set(t.idpropriedade, [])
        }
        tarifarioByProp.get(t.idpropriedade)!.push({
            idpropriedade: t.idpropriedade,
            from: typeof t.from === 'object' ? t.from.value : String(t.from),
            to: String(t.to),
            baserate: t.baserate,
        })
    })

    const discountsByProp = new Map<string, BQDiscount[]>()
    bqDiscounts.forEach((d) => {
        if (!discountsByProp.has(d.idpropriedade)) discountsByProp.set(d.idpropriedade, [])
        discountsByProp.get(d.idpropriedade)!.push({
            ...d,
            date: typeof d.date === 'object' ? d.date.value : String(d.date) as any
        })
    })

    // Build integrated data
    return bqPropriedades.map((prop) => {
        const propriedade = transformBQPropriedade(prop)
        const propReservas = reservasByProp.get(prop.idpropriedade) || []
        const propMetas = metasByProp.get(prop.idpropriedade) || []
        const propSalesGoals = salesGoalsByProp.get(prop.idpropriedade)
        const propOcupacao = bqOcupacao.filter(o => o.idpropriedade === prop.idpropriedade)
        const metricas = calculateMetrics(propReservas, propMetas, propOcupacao)

        return {
            propriedade,
            reservas: propReservas,
            metas: propMetas,
            salesGoals: propSalesGoals,
            metricas,
            ocupacao: propOcupacao,
            tarifario: tarifarioByProp.get(prop.idpropriedade) || [],
            discounts: discountsByProp.get(prop.idpropriedade) || []
        }
    })
}
