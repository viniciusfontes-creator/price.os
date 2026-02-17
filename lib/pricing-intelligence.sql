-- Pricing Intelligence Query
-- This query calculates dynamic pricing recommendations based on:
-- 1. Lead time by location (praça)
-- 2. Target month occupancy (Today + Lead Time)
-- 3. Revenue gap vs monthly goals
-- 4. Strategic ceiling of 18 nights sold

WITH LeadTimeDinamico AS (
    SELECT
        p.praca,
        CAST(
            ROUND(
                AVG(
                    DATE_DIFF(
                        PARSE_DATE('%d-%m-%Y', r.checkInDate),
                        PARSE_DATE('%d-%m-%Y', r.creationDate),
                        DAY
                    )
                ), 0
            ) AS INT64
        ) AS lead_time_momento
    FROM warehouse.propriedades_subgrupos p
    JOIN warehouse.reservas_all r
        ON p.IdPropriedade = r.idPropriedade
    WHERE r.type != 'canceled'
      AND PARSE_DATE('%d-%m-%Y', r.creationDate) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY 1
),
AnaliseProjetada AS (
    SELECT
        p.IdPropriedade,
        p.nomePropriedade,
        p.praca,
        COALESCE(ltd.lead_time_momento, 0) AS lead_time_momento,
        EXTRACT(MONTH FROM DATE_ADD(CURRENT_DATE(), INTERVAL COALESCE(ltd.lead_time_momento,0) DAY)) AS mes_alvo,
        EXTRACT(YEAR FROM DATE_ADD(CURRENT_DATE(), INTERVAL COALESCE(ltd.lead_time_momento,0) DAY)) AS ano_alvo
    FROM warehouse.propriedades_subgrupos p
    LEFT JOIN LeadTimeDinamico ltd
        ON p.praca = ltd.praca
    WHERE p.Status_Aparente = 'Ativa'
),
OcupacaoMes AS (
    SELECT
        idpropriedade,
        EXTRACT(MONTH FROM datas) AS mes,
        EXTRACT(YEAR FROM datas) AS ano,
        COUNTIF(ocupado = 1) AS noites_vendidas,
        COUNTIF(ocupado = 0) AS noites_livres
    FROM stage.ocupacaoDisponibilidade_teste1
    GROUP BY 1,2,3
),
FinanceiroMes AS (
    SELECT
        r.idPropriedade,
        EXTRACT(MONTH FROM PARSE_DATE('%d-%m-%Y', r.checkOutDate)) AS mes,
        EXTRACT(YEAR FROM PARSE_DATE('%d-%m-%Y', r.checkOutDate)) AS ano,
        SUM(r.reserveTotal) AS faturamento_realizado
    FROM warehouse.reservas_all r
    WHERE r.type != 'canceled'
    GROUP BY 1,2,3
),
TarifarioAtual AS (
    SELECT
        id,
        ROUND(AVG(baseratevalue),2) AS baserate_atual
    FROM stage.stays_listing_rates_sell
    GROUP BY 1
),
UltimaVenda AS (
    SELECT
        idPropriedade,
        MAX(PARSE_DATE('%d-%m-%Y', creationDate)) AS data_ultima_venda
    FROM warehouse.reservas_all
    WHERE type != 'canceled'
    GROUP BY 1
),
BaseModelo AS (
    SELECT
        a.IdPropriedade,
        a.nomePropriedade,
        a.praca,
        a.lead_time_momento,
        a.mes_alvo,
        a.ano_alvo,
        m.meta AS meta_mes,
        COALESCE(f.faturamento_realizado,0) AS realizado_mes,
        (m.meta - COALESCE(f.faturamento_realizado,0)) AS gap_faturamento,
        COALESCE(o.noites_vendidas, 0) AS noites_vendidas,
        COALESCE(o.noites_livres, 0) AS noites_livres,
        GREATEST(18 - COALESCE(o.noites_vendidas, 0), 0) AS noites_restantes_no_teto,
        SAFE_DIVIDE(m.meta, 20) AS preco_min_absoluto,
        t.baserate_atual,
        u.data_ultima_venda,
        DATE_DIFF(CURRENT_DATE(), u.data_ultima_venda, DAY) AS dias_sem_venda
    FROM AnaliseProjetada a
    JOIN stage.metas_checkout_mensais_unidade m
        ON a.IdPropriedade = m.IdPropriedade
       AND m.mes_ano = FORMAT('%02d/%d', a.mes_alvo, a.ano_alvo)
    LEFT JOIN FinanceiroMes f
        ON a.IdPropriedade = f.idPropriedade
       AND f.mes = a.mes_alvo
       AND f.ano = a.ano_alvo
    LEFT JOIN OcupacaoMes o
        ON a.IdPropriedade = o.idpropriedade
       AND o.mes = a.mes_alvo
       AND o.ano = a.ano_alvo
    LEFT JOIN TarifarioAtual t
        ON a.IdPropriedade = t.id
    LEFT JOIN UltimaVenda u
        ON a.IdPropriedade = u.idPropriedade
),
PrecoCalculado AS (
    SELECT *,
        LEAST(noites_livres, noites_restantes_no_teto) AS noites_para_venda_efetiva
    FROM BaseModelo
)
SELECT
    IdPropriedade,
    nomePropriedade,
    praca,
    lead_time_momento,
    mes_alvo,
    ano_alvo,
    meta_mes,
    realizado_mes,
    gap_faturamento,
    noites_vendidas,
    noites_livres,
    noites_para_venda_efetiva,
    preco_min_absoluto,
    ROUND(
        GREATEST(
            SAFE_DIVIDE(gap_faturamento, NULLIF(noites_para_venda_efetiva, 0)),
            preco_min_absoluto
        ),
        2
    ) AS preco_sugerido,
    baserate_atual AS preco_vitrine_hoje,
    data_ultima_venda,
    dias_sem_venda,
    CASE
        WHEN gap_faturamento <= 0
            THEN 'META ATINGIDA'
        WHEN noites_vendidas >= 18 AND gap_faturamento > 0
            THEN 'TETO DE 18 NOITES ATINGIDO - MANTER ADR ALTO'
        WHEN noites_para_venda_efetiva = 0 AND gap_faturamento > 0
            THEN 'META INATINGIVEL - SEM CALENDARIO'
        WHEN (SAFE_DIVIDE(gap_faturamento, NULLIF(noites_para_venda_efetiva, 0))) < preco_min_absoluto
            THEN 'PRECO NO PISO MINIMO (DIV 20)'
        ELSE
            'ATUAR NO PRECO SUGERIDO (TETO 18 NOITES)'
    END AS acao_sugerida
FROM PrecoCalculado
ORDER BY
    IdPropriedade
