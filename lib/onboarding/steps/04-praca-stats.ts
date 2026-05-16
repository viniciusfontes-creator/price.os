/**
 * Step 4: Estatísticas de faturamento por praça (BQ).
 *
 * Porte do node "Analise estatística" do workflow n8n.
 * Filtra: status='Ativa', empreendimento='Short Stay', > 120 noites em 2025.
 * Workaround: duplica a praça 'Milagres' como 'Maceió' (igual ao n8n).
 */

import { executeQuery } from "@/lib/bigquery-client"
import type {
    PipelineContext,
    PracaMonthDetail,
    PracaStats,
} from "../types"

const SQL = `
WITH reservas_2025 AS (
  SELECT
    r.idPropriedade,
    p.praca,
    r.reserveTotal,
    r.pricePerNight,
    r.nightCount,
    PARSE_DATE('%d-%m-%Y', r.checkoutdate) AS checkoutdate_parsed,
    CASE
      WHEN CAST(SPLIT(r.checkoutdate, '-')[1] AS INT64) = 1  THEN 'Janeiro'
      WHEN CAST(SPLIT(r.checkoutdate, '-')[1] AS INT64) = 2  THEN 'Fevereiro'
      WHEN CAST(SPLIT(r.checkoutdate, '-')[1] AS INT64) = 3  THEN 'Março'
      WHEN CAST(SPLIT(r.checkoutdate, '-')[1] AS INT64) = 4  THEN 'Abril'
      WHEN CAST(SPLIT(r.checkoutdate, '-')[1] AS INT64) = 5  THEN 'Maio'
      WHEN CAST(SPLIT(r.checkoutdate, '-')[1] AS INT64) = 6  THEN 'Junho'
      WHEN CAST(SPLIT(r.checkoutdate, '-')[1] AS INT64) = 7  THEN 'Julho'
      WHEN CAST(SPLIT(r.checkoutdate, '-')[1] AS INT64) = 8  THEN 'Agosto'
      WHEN CAST(SPLIT(r.checkoutdate, '-')[1] AS INT64) = 9  THEN 'Setembro'
      WHEN CAST(SPLIT(r.checkoutdate, '-')[1] AS INT64) = 10 THEN 'Outubro'
      WHEN CAST(SPLIT(r.checkoutdate, '-')[1] AS INT64) = 11 THEN 'Novembro'
      WHEN CAST(SPLIT(r.checkoutdate, '-')[1] AS INT64) = 12 THEN 'Dezembro'
    END AS mes,
    CAST(SPLIT(r.checkoutdate, '-')[1] AS INT64) AS mes_num
  FROM \`warehouse.reservas_all\` r
  INNER JOIN \`warehouse.propriedades_subgrupos\` p
    ON r.idPropriedade = p.idPropriedade
  WHERE r.type != 'canceled'
    AND r.reserveTotal IS NOT NULL AND r.reserveTotal > 0
    AND r.nightCount   IS NOT NULL AND r.nightCount   > 0
    AND EXTRACT(YEAR FROM PARSE_DATE('%d-%m-%Y', r.checkoutdate)) = 2025
    AND p.praca IS NOT NULL
    AND p.empreendimento_pousada = 'Short Stay'
    AND p.status_aparente = 'Ativa'
),
propriedades_qualificadas AS (
  SELECT idPropriedade
  FROM reservas_2025
  GROUP BY idPropriedade
  HAVING SUM(nightCount) > 120
),
reservas_filtradas AS (
  SELECT r.* FROM reservas_2025 r
  INNER JOIN propriedades_qualificadas pq ON r.idPropriedade = pq.idPropriedade
),
faturamento_prop_mes AS (
  SELECT idPropriedade, praca, mes, mes_num,
         COUNT(*) AS total_reservas,
         SUM(reserveTotal) AS faturamento_total_prop,
         SUM(nightCount)   AS total_noites_prop
  FROM reservas_filtradas
  GROUP BY idPropriedade, praca, mes, mes_num
),
faturamento_prop_ano AS (
  SELECT idPropriedade, praca,
         SUM(reserveTotal) AS faturamento_total_prop,
         SUM(nightCount)   AS total_noites_prop
  FROM reservas_filtradas
  GROUP BY idPropriedade, praca
),
estat_praca_mes AS (
  SELECT praca, mes, mes_num,
         COUNT(DISTINCT idPropriedade) AS total_propriedades,
         SUM(total_reservas) AS total_reservas,
         SUM(faturamento_total_prop) AS faturamento_total,
         SUM(total_noites_prop)      AS total_noites
  FROM faturamento_prop_mes
  GROUP BY praca, mes, mes_num
),
estat_praca_ano AS (
  SELECT praca,
         COUNT(DISTINCT idPropriedade) AS total_propriedades_ano,
         SUM(faturamento_total_prop)   AS faturamento_total_ano,
         SUM(total_noites_prop)        AS total_noites_ano,
         (SELECT COUNT(*) FROM reservas_filtradas r2 WHERE r2.praca = fpa.praca) AS total_reservas_ano
  FROM faturamento_prop_ano fpa
  GROUP BY praca
)
SELECT
  m.praca,
  a.total_propriedades_ano,
  a.total_reservas_ano,
  ROUND(a.faturamento_total_ano, 2) AS faturamento_total_ano,
  a.total_noites_ano,
  ARRAY_AGG(STRUCT(
    m.mes,
    m.total_propriedades,
    m.total_reservas,
    ROUND(m.faturamento_total, 2) AS faturamento_total,
    m.total_noites,
    ROUND(SAFE_DIVIDE(m.faturamento_total, a.faturamento_total_ano) * 100, 2) AS perc_faturamento_ano,
    ROUND(SAFE_DIVIDE(m.total_noites,      a.total_noites_ano)      * 100, 2) AS perc_ocupacao_ano
  ) ORDER BY m.mes_num) AS detalhamento_mensal
FROM estat_praca_mes m
INNER JOIN estat_praca_ano a ON m.praca = a.praca
WHERE m.praca = @praca OR (@praca = 'Maceió' AND m.praca = 'Milagres')
GROUP BY m.praca, a.total_propriedades_ano, a.total_reservas_ano, a.faturamento_total_ano, a.total_noites_ano
LIMIT 1
`

interface BqRow {
    praca: string
    total_propriedades_ano: number
    total_reservas_ano: number
    faturamento_total_ano: number
    total_noites_ano: number
    detalhamento_mensal: PracaMonthDetail[]
}

export async function pracaStats(ctx: PipelineContext): Promise<PipelineContext> {
    const praca = ctx.payload.localidade || ctx.bq?.praca || null
    if (!praca) return { ...ctx, pracaStats: null }

    const rows = await executeQuery<BqRow>(SQL, { praca })
    if (!rows.length) return { ...ctx, pracaStats: null }

    const r = rows[0]
    const stats: PracaStats = {
        praca: praca,
        total_propriedades_ano: Number(r.total_propriedades_ano) || 0,
        total_reservas_ano: Number(r.total_reservas_ano) || 0,
        faturamento_total_ano: Number(r.faturamento_total_ano) || 0,
        total_noites_ano: Number(r.total_noites_ano) || 0,
        detalhamento_mensal: (r.detalhamento_mensal || []).map((m) => ({
            mes: m.mes,
            total_propriedades: Number(m.total_propriedades) || 0,
            total_reservas: Number(m.total_reservas) || 0,
            faturamento_total: Number(m.faturamento_total) || 0,
            total_noites: Number(m.total_noites) || 0,
            perc_faturamento_ano: Number(m.perc_faturamento_ano) || 0,
            perc_ocupacao_ano: Number(m.perc_ocupacao_ano) || 0,
        })),
    }

    return { ...ctx, pracaStats: stats }
}
