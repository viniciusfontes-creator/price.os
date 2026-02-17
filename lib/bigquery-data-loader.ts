/**
 * BigQuery Data Loader
 * 
 * This file contains functions to transform BigQuery data into the format
 * expected by the dashboard components (IntegratedData).
 * 
 * The actual BigQuery queries are executed via MCP tools.
 */

import type { IntegratedData, WebhookPropriedade, WebhookReserva, WebhookMeta, SalesGoals } from "@/types"

// SQL Queries for BigQuery (to be used with MCP execute_sql tool)
export const BIGQUERY_QUERIES = {
    // Properties with aggregated reservation data
    PROPERTIES_WITH_STATS: `
    SELECT
      p.idpropriedade,
      p.nomepropriedade,
      p.grupo_nome,
      p.praca,
      p.empreendimento_pousada,
      p.sub_grupo,
      p.nome_externo,
      p.cidade,
      p.estado,
      SAFE_CAST(p.latitude AS FLOAT64) as latitude,
      SAFE_CAST(p.longitude AS FLOAT64) as longitude,
      SAFE_CAST(p._i_maxguests AS INT64) as _i_maxguests
    FROM \`warehouse.propriedades_subgrupos\` p
    WHERE p.status_aparente = 'Ativa'
  `,

    // Reservations for the last 90 days
    RESERVATIONS_90_DAYS: `
    SELECT
      CAST(idpropriedade AS STRING) AS idpropriedade,
      CAST(PARSE_DATE('%d-%m-%Y', checkoutdate) AS DATE) AS checkoutdate,
      CAST(PARSE_DATE('%d-%m-%Y', creationdate) AS DATE) AS creationdate,
      CAST(PARSE_DATE('%d-%m-%Y', checkindate) AS DATE) AS checkindate,
      SAFE_CAST(buyprice AS NUMERIC) AS buyprice,
      SAFE_CAST(reservetotal AS NUMERIC) AS reservetotal,
      SAFE_CAST(companycommision AS NUMERIC) AS companycommision,
      SAFE_CAST(nightcount AS INT64) AS nightcount,
      SAFE_CAST(guesttotalcount AS INT64) AS guesttotalcount,
      SAFE_CAST(pricepernight AS NUMERIC) AS pricepernight,
      CASE
        WHEN LOWER(partnername) LIKE '%curta%' THEN 'CurtaBora'
        WHEN partnername IN ('Atendimento', 'Atendimento Host') THEN 'Atendimento'
        ELSE partnername
      END AS partnername,
      agentName as agentname
    FROM \`warehouse.reservas_all\`
    WHERE partnername <> 'External API'
      AND buyprice > 0
      AND reservetotal > 0
      AND LOWER(type) NOT LIKE '%canceled%'
      AND PARSE_DATE('%d-%m-%Y', creationdate) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    ORDER BY creationdate DESC
  `,

    // Goals by checkout
    GOALS_CHECKOUT: `
    SELECT
      IdPropriedade as idpropriedade,
      FORMAT_DATE('%m/%Y', PARSE_DATE('%m/%Y', mes_ano)) AS mes_ano,
      SAFE_CAST(meta AS NUMERIC) AS meta,
      SAFE_CAST(meta_movel AS NUMERIC) AS meta_movel
    FROM \`warehouse.meta_e_meta_movel_checkout\`
    WHERE mes_ano = FORMAT_DATE('%m/%Y', CURRENT_DATE())
  `,

    // Daily sales summary
    DAILY_SALES: `
    SELECT
      CAST(PARSE_DATE('%d-%m-%Y', creationdate) AS DATE) AS data_venda,
      COUNT(*) as total_reservas,
      SUM(SAFE_CAST(reservetotal AS NUMERIC)) as receita_total,
      SUM(SAFE_CAST(nightcount AS INT64)) as diarias_vendidas
    FROM \`warehouse.reservas_all\`
    WHERE partnername <> 'External API'
      AND buyprice > 0
      AND reservetotal > 0
      AND LOWER(type) NOT LIKE '%canceled%'
      AND PARSE_DATE('%d-%m-%Y', creationdate) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY data_venda
    ORDER BY data_venda DESC
  `,

    // Partner sales summary
    PARTNER_SALES: `
    SELECT
      CASE
        WHEN LOWER(partnername) LIKE '%curta%' THEN 'CurtaBora'
        WHEN partnername IN ('Atendimento', 'Atendimento Host') THEN 'Atendimento'
        ELSE partnername
      END AS partnername,
      COUNT(*) as total_reservas,
      SUM(SAFE_CAST(reservetotal AS NUMERIC)) as receita_total,
      SUM(SAFE_CAST(nightcount AS INT64)) as diarias_vendidas
    FROM \`warehouse.reservas_all\`
    WHERE partnername <> 'External API'
      AND buyprice > 0
      AND reservetotal > 0
      AND LOWER(type) NOT LIKE '%canceled%'
      AND PARSE_DATE('%d-%m-%Y', creationdate) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY 1
    ORDER BY receita_total DESC
  `
}

// BigQuery result types
export interface BQProperty {
    idpropriedade: string
    nomepropriedade: string
    grupo_nome: string
    praca: string
    empreendimento_pousada: string
    sub_grupo: string | null
    nome_externo: string | null
    cidade: string | null
    estado: string | null
    latitude: number | null
    longitude: number | null
    _i_maxguests: number | null
}

export interface BQReservation {
    idpropriedade: string
    checkoutdate: string
    creationdate: string
    checkindate: string
    buyprice: number | string
    reservetotal: number | string
    companycommision: number | string
    nightcount: number
    guesttotalcount: number
    pricepernight: number | string
    partnername: string
    agentname: string | null
}

export interface BQGoal {
    idpropriedade: string
    mes_ano: string
    meta: number | null
    meta_movel: number | null
}

// Transform BigQuery property to WebhookPropriedade
export function transformProperty(bq: BQProperty): WebhookPropriedade {
    return {
        idpropriedade: bq.idpropriedade,
        nomepropriedade: bq.nomepropriedade,
        grupo_nome: bq.grupo_nome || "",
        praca: bq.praca || "",
        empreendimento_pousada: bq.empreendimento_pousada || "Short Stay",
        sub_grupo: bq.sub_grupo || "",
        nome_externo: bq.nome_externo || bq.nomepropriedade,
        Status_Aparente: "Ativo",
        longitude: bq.longitude || 0,
        latitude: bq.latitude || 0,
        _i_maxguests: bq._i_maxguests || 4,
    }
}

// Transform BigQuery reservation to WebhookReserva
export function transformReservation(bq: BQReservation): WebhookReserva {
    const creationDate = new Date(bq.creationdate)
    const checkinDate = new Date(bq.checkindate)
    const antecedencia = Math.max(0, Math.floor((checkinDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24)))

    return {
        idpropriedade: bq.idpropriedade,
        checkoutdate: bq.checkoutdate,
        creationdate: bq.creationdate,
        checkindate: bq.checkindate,
        antecedencia_reserva: antecedencia,
        guesttotalcount: bq.guesttotalcount || 2,
        nightcount: bq.nightcount || 1,
        pricepernight: Number(bq.pricepernight) || 0,
        partnername: bq.partnername || "Direto",
        agentname: bq.agentname || null,
        buyprice: Number(bq.buyprice) || 0,
        reservetotal: Number(bq.reservetotal) || 0,
        companycommision: Number(bq.companycommision) || 0,
    }
}

// Transform BigQuery goal to WebhookMeta
export function transformGoal(bq: BQGoal): WebhookMeta {
    return {
        idpropriedade: bq.idpropriedade,
        mes: bq.mes_ano,
        meta: Number(bq.meta) || 0,
    }
}

// Transform all data into IntegratedData format
export function transformToIntegratedData(
    properties: BQProperty[],
    reservations: BQReservation[],
    goals: BQGoal[]
): IntegratedData[] {
    const reservationsByProperty = new Map<string, WebhookReserva[]>()
    const goalsByProperty = new Map<string, WebhookMeta[]>()

    // Group reservations by property
    reservations.forEach(r => {
        const propertyId = r.idpropriedade
        if (!reservationsByProperty.has(propertyId)) {
            reservationsByProperty.set(propertyId, [])
        }
        reservationsByProperty.get(propertyId)!.push(transformReservation(r))
    })

    // Group goals by property
    goals.forEach(g => {
        const propertyId = g.idpropriedade
        if (!goalsByProperty.has(propertyId)) {
            goalsByProperty.set(propertyId, [])
        }
        goalsByProperty.get(propertyId)!.push(transformGoal(g))
    })

    // Build IntegratedData for each property
    return properties.map(prop => {
        const propriedade = transformProperty(prop)
        const reservas = reservationsByProperty.get(prop.idpropriedade) || []
        const metas = goalsByProperty.get(prop.idpropriedade) || []

        // Calculate sales goals from reservations
        const today = new Date()
        const currentMonth = today.getMonth()
        const currentYear = today.getFullYear()

        // Filter reservations by creation date for this month
        const thisMonthReservations = reservas.filter(r => {
            const creationDate = new Date(r.creationdate)
            return creationDate.getMonth() === currentMonth && creationDate.getFullYear() === currentYear
        })

        // Filter reservations by checkout date for this month
        const thisMonthCheckouts = reservas.filter(r => {
            const checkoutDate = new Date(r.checkoutdate)
            return checkoutDate.getMonth() === currentMonth && checkoutDate.getFullYear() === currentYear
        })

        const meta = metas.length > 0 ? metas[0].meta : 0

        const salesGoals: SalesGoals = {
            metaMensalCheckout: meta,
            metaMensalCriacao: meta,
            atingidoCheckout: thisMonthCheckouts.reduce((sum, r) => sum + r.reservetotal, 0),
            atingidoCriacao: thisMonthReservations.reduce((sum, r) => sum + r.reservetotal, 0),
            percentualCheckout: 0,
            percentualCriacao: 0,
        }

        if (meta > 0) {
            salesGoals.percentualCheckout = (salesGoals.atingidoCheckout / meta) * 100
            salesGoals.percentualCriacao = (salesGoals.atingidoCriacao / meta) * 100
        }

        return {
            propriedade,
            reservas,
            metas,
            salesGoals,
        }
    })
}
