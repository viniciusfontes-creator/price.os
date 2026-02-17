/**
 * BigQuery SQL Queries
 * 
 * Contains all SQL queries for fetching data from BigQuery.
 * These queries are used by MCP BigQuery tools.
 */

// SQL #1 - Properties
export const SQL_PROPERTIES = `
SELECT
  p.idpropriedade,
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
  SELECT id, ROUND(AVG(CAST(price_brl AS NUMERIC)), 2) as baserate_atual
  FROM \`stage.stays_calendar_listing\`
  WHERE date >= FORMAT_DATE('%Y-%m-%d', CURRENT_DATE())
  GROUP BY id
) t ON p.idpropriedade = t.id
WHERE
  p.status_aparente = 'Ativa'
`

// SQL #2 - Reservations
export const SQL_RESERVATIONS = `
SELECT
  CAST(idpropriedade AS STRING) AS idpropriedade,
  CAST(companycommision AS NUMERIC) AS companycommision,
  CAST(buyprice AS NUMERIC) AS buyprice,
  CAST(reservetotal AS NUMERIC) AS reservetotal,
  CAST(PARSE_DATE('%d-%m-%Y', checkoutdate) AS DATE) AS checkoutdate,
  CAST(PARSE_DATE('%d-%m-%Y', creationdate) AS DATE) AS creationdate,
  CAST(PARSE_DATE('%d-%m-%Y', checkindate) AS DATE) AS checkindate,
  CAST(
    GREATEST(
      DATE_DIFF(
        PARSE_DATE('%d-%m-%Y', checkindate),
        PARSE_DATE('%d-%m-%Y', creationdate),
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

// SQL #3 - Goals by Checkout
export const SQL_GOALS_CHECKOUT = `
SELECT
  IdPropriedade,
  DATE(
    EXTRACT(YEAR FROM PARSE_DATE('%m/%Y', mes_ano)),
    EXTRACT(MONTH FROM PARSE_DATE('%m/%Y', mes_ano)),
    ROW_NUMBER() OVER (
      PARTITION BY IdPropriedade, mes_ano 
      ORDER BY IdPropriedade
    )
  ) AS data_especifica,
  FORMAT_DATE('%m/%Y', PARSE_DATE('%m/%Y', mes_ano)) AS mes_ano,
  SAFE_CAST(meta AS NUMERIC) AS meta,
  SAFE_CAST(meta_movel AS NUMERIC) AS meta_movel
FROM
  \`warehouse.meta_e_meta_movel_checkout\`
ORDER BY 
  IdPropriedade, 
  PARSE_DATE('%m/%Y', mes_ano),
  data_especifica
`

// SQL #4 - Goals by Creation Date (Weekly)
export const SQL_GOALS_CREATION = `
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

// Type definitions for BigQuery results
export interface BQProperty {
  idpropriedade: string
  nomepropriedade: string
  _i_maxguests: string | null
  nome_externo: string | null
  cidade: string | null
  estado: string | null
  latitude: string | null
  longitude: string | null
  _i_rooms: string | null
  pricemaster: string | null
  grupo_nome: string
  praca: string
  empreendimento_pousada: string
  sub_grupo: string | null
  baserate_atual: number | null
}

export interface BQReservation {
  idpropriedade: string
  companycommision: number
  buyprice: number
  reservetotal: number
  checkoutdate: string
  creationdate: string
  checkindate: string
  antecedencia_reserva: number
  guesttotalcount: number
  nightcount: number
  pricepernight: number
  partnername: string
  agentname: string
}

export interface BQGoalCheckout {
  IdPropriedade: string
  data_especifica: string
  mes_ano: string
  meta: number
  meta_movel: number
}

export interface BQGoalCreation {
  IdPropriedade: string
  Mes: number
  Meta: number
  semana_numero: number
  data_inicio_semana: string
  data_fim_semana: string
  meta_semanal: number
}
