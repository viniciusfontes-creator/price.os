/**
 * Step 5: Distribuição da meta anual em 12 meses.
 *
 * Porte 1:1 do node "Cálculo das metas" do workflow n8n. Mantém:
 *   - Detecção automática de Carnaval (Mar > Fev × 1.3 → swap)
 *   - Mínimo de 5% por mês
 *   - Garantia Fevereiro > Março
 *   - Range de noites/mês 12-18
 *   - Configuração de feriados (perc + noites)
 *   - Lotes 1 (40% noites / 50% fat) e 2 (60% noites / 50% fat) p/ não-feriado
 */

import { FERIADOS, ONBOARDING_RULES } from "../constants"
import type {
    MetaDistribuicaoMensal,
    PipelineContext,
    PracaMonthDetail,
} from "../types"

export function calculateTargets(ctx: PipelineContext): PipelineContext {
    const detalhe = ctx.pracaStats?.detalhamento_mensal || []
    const propertyValue = ctx.estimate?.propertyValue ?? 0
    const metaAnual = Number((propertyValue * ONBOARDING_RULES.META_ANUAL_PERC).toFixed(2))

    if (!metaAnual || detalhe.length === 0) {
        return { ...ctx, metaAnual, metaDistribuicao: [] }
    }

    // ---- 1. Detecção e correção do Carnaval (Mar > Fev × 1.3) ----
    const detalheCorr = detalhe.map((m) => ({ ...m })) as PracaMonthDetail[]
    const fev = detalheCorr.find((m) => m.mes === "Fevereiro")
    const mar = detalheCorr.find((m) => m.mes === "Março")
    let carnavalEmMarco = false
    let fevCorrFat = fev?.faturamento_total
    let marCorrFat = mar?.faturamento_total
    let fevCorrNoi = fev?.total_noites
    let marCorrNoi = mar?.total_noites
    if (
        fev &&
        mar &&
        mar.faturamento_total > fev.faturamento_total * ONBOARDING_RULES.CARNAVAL_THRESHOLD
    ) {
        carnavalEmMarco = true
        fevCorrFat = mar.faturamento_total
        marCorrFat = fev.faturamento_total
        fevCorrNoi = mar.total_noites
        marCorrNoi = fev.total_noites
    }

    // ---- 2. Total faturamento corrigido ----
    let totalFaturamento = 0
    detalheCorr.forEach((m) => {
        if (carnavalEmMarco && m.mes === "Fevereiro") totalFaturamento += fevCorrFat || 0
        else if (carnavalEmMarco && m.mes === "Março") totalFaturamento += marCorrFat || 0
        else totalFaturamento += m.faturamento_total || 0
    })

    // ---- 3. Distribuição inicial proporcional + garantia mínimo 5% ----
    const PERC_MIN = ONBOARDING_RULES.PERC_MIN_MES
    const metaMin = metaAnual * PERC_MIN

    const distInicial = detalheCorr.map((item) => {
        const fatCorr =
            carnavalEmMarco && item.mes === "Fevereiro"
                ? fevCorrFat || 0
                : carnavalEmMarco && item.mes === "Março"
                ? marCorrFat || 0
                : item.faturamento_total || 0
        const perc = totalFaturamento > 0 ? fatCorr / totalFaturamento : 1 / 12
        return { mes: item.mes, metaInicial: metaAnual * perc }
    })

    let deficit = 0
    const abaixo: typeof distInicial = []
    const acima: typeof distInicial = []
    distInicial.forEach((it) => {
        if (it.metaInicial < metaMin) {
            deficit += metaMin - it.metaInicial
            abaixo.push(it)
        } else acima.push(it)
    })

    const metasAjustadas: Record<string, number> = {}
    abaixo.forEach((it) => (metasAjustadas[it.mes] = metaMin))
    if (acima.length > 0) {
        const totalAcima = acima.reduce((s, m) => s + m.metaInicial, 0)
        acima.forEach((it) => {
            const proporcao = it.metaInicial / totalAcima
            metasAjustadas[it.mes] = Math.max(metaMin, it.metaInicial - deficit * proporcao)
        })
    }

    // ---- 4. Garantir Fevereiro > Março ----
    if (
        metasAjustadas["Março"] != null &&
        metasAjustadas["Fevereiro"] != null &&
        metasAjustadas["Março"] > metasAjustadas["Fevereiro"]
    ) {
        const tmp = metasAjustadas["Fevereiro"]
        metasAjustadas["Fevereiro"] = metasAjustadas["Março"]
        metasAjustadas["Março"] = tmp
    }

    // ---- 5. Meta de noites por mês (clamp 12-18) ----
    const noitesMensal: Record<string, number> = {}
    detalheCorr.forEach((item) => {
        const perc = item.perc_ocupacao_ano || 8.33
        let noites = Math.round((perc / 100) * ONBOARDING_RULES.DIAS_BASE_ANO)
        noites = Math.max(ONBOARDING_RULES.NOITES_MES.min, Math.min(ONBOARDING_RULES.NOITES_MES.max, noites))
        noitesMensal[item.mes] = noites
    })

    // Ajuste proporcional Fev > Mar para noites também
    if (
        metasAjustadas["Fevereiro"] > metasAjustadas["Março"] &&
        noitesMensal["Março"] > noitesMensal["Fevereiro"]
    ) {
        const tmp = noitesMensal["Fevereiro"]
        noitesMensal["Fevereiro"] = noitesMensal["Março"]
        noitesMensal["Março"] = tmp
    }

    // ---- 6. Distribuição final por mês (com lotes e feriados) ----
    const distribuicao: MetaDistribuicaoMensal[] = detalheCorr.map((item) => {
        const mes = item.mes
        const meta_faturamento = Number((metasAjustadas[mes] || 0).toFixed(2))
        const meta_noites = noitesMensal[mes] || 0
        const meta_diaria_media =
            meta_noites > 0 ? Number((meta_faturamento / meta_noites).toFixed(2)) : 0

        const cfg = FERIADOS[mes]
        let feriado: MetaDistribuicaoMensal["feriado"] = null
        let nao_feriado: MetaDistribuicaoMensal["nao_feriado"]

        if (cfg) {
            const fatFeriado = Number((meta_faturamento * cfg.perc).toFixed(2))
            const noitesFeriado = cfg.noites
            feriado = {
                nome: cfg.nome,
                pacote_dias: Math.round(cfg.noites),
                noites_feriado: noitesFeriado,
                faturamento_feriado: fatFeriado,
                diaria_media_feriado:
                    noitesFeriado > 0 ? Number((fatFeriado / noitesFeriado).toFixed(2)) : 0,
            }
            const fatNormal = Number((meta_faturamento - fatFeriado).toFixed(2))
            const noitesNormal = Math.max(0, meta_noites - noitesFeriado)
            nao_feriado = {
                noites_nao_feriado: noitesNormal,
                faturamento_nao_feriado: fatNormal,
                diaria_media_nao_feriado:
                    noitesNormal > 0 ? Number((fatNormal / noitesNormal).toFixed(2)) : 0,
                lote_1: {
                    noites: Number((noitesNormal * 0.4).toFixed(2)),
                    faturamento: Number((fatNormal * 0.5).toFixed(2)),
                },
                lote_2: {
                    noites: Number((noitesNormal * 0.6).toFixed(2)),
                    faturamento: Number((fatNormal * 0.5).toFixed(2)),
                },
            }
        } else {
            nao_feriado = {
                noites_nao_feriado: meta_noites,
                faturamento_nao_feriado: meta_faturamento,
                diaria_media_nao_feriado: meta_diaria_media,
                lote_1: {
                    noites: Number((meta_noites * 0.4).toFixed(2)),
                    faturamento: Number((meta_faturamento * 0.5).toFixed(2)),
                },
                lote_2: {
                    noites: Number((meta_noites * 0.6).toFixed(2)),
                    faturamento: Number((meta_faturamento * 0.5).toFixed(2)),
                },
            }
        }

        return {
            mes,
            percentual_anual: ((meta_faturamento / metaAnual) * 100).toFixed(1) + "%",
            noites_ano_passado: item.total_noites,
            meta_noites_2026: meta_noites,
            meta_faturamento,
            meta_diaria_media,
            feriado,
            nao_feriado,
        }
    })

    return { ...ctx, metaAnual, metaDistribuicao: distribuicao }
}
