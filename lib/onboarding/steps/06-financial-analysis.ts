/**
 * Step 6: Análise financeira (comissão, custos, ROI).
 *
 * Porte 1:1 do node "Preparação final" do workflow n8n.
 *   - Comissão QAV: 20% sobre faturamento bruto
 *   - Custo fixo anual: 3% do valor do imóvel
 *   - Custo variável: R$ 25 por quarto/noite
 *   - Receita líquida = faturamento - comissão
 *   - Custo total = custo fixo + custo variável
 *   - Valor líquido = receita líquida - custo total
 *   - Rentabilidade total = operacional + valorização
 */

import { ONBOARDING_RULES } from "../constants"
import type {
    AnaliseFinanceira,
    PipelineContext,
    ValorLiquidoMensal,
} from "../types"

export function financialAnalysis(ctx: PipelineContext): PipelineContext {
    const valorImovel = ctx.estimate?.propertyValue || 0
    const valorizacaoAnual = ctx.estimate?.propertyAppreciation || 0
    const metaAnual = ctx.metaAnual || 0
    const distribuicao = ctx.metaDistribuicao || []
    const quartos = Number(ctx.payload.quartos ?? ctx.bq?._i_rooms ?? 0) || 0

    const COMISSAO = ONBOARDING_RULES.COMISSAO_QAV
    const CUSTO_FIXO_PERC = ONBOARDING_RULES.CUSTO_FIXO_ANUAL_PERC
    const CUSTO_VAR_NOITE = ONBOARDING_RULES.CUSTO_VARIAVEL_QUARTO_NOITE

    const custoFixoAnual = valorImovel * CUSTO_FIXO_PERC
    const custoFixoMensal = custoFixoAnual / 12

    const valor_liquido_mensal: ValorLiquidoMensal[] = distribuicao.map((mes) => {
        const faturamento = mes.meta_faturamento
        const noites = mes.meta_noites_2026
        const diaria = mes.meta_diaria_media

        const comissao = faturamento * COMISSAO
        const custoVar = noites * quartos * CUSTO_VAR_NOITE
        const receitaLiq = faturamento - comissao
        const custoTotal = custoFixoMensal + custoVar
        const valorLiq = receitaLiq - custoTotal

        const liqPorNoite = diaria * (1 - COMISSAO) - quartos * CUSTO_VAR_NOITE
        const breakeven =
            liqPorNoite > 0 ? Number((custoFixoMensal / liqPorNoite).toFixed(2)) : null

        return {
            mes: mes.mes,
            faturamento_bruto: round2(faturamento),
            noites,
            comissao_qav: round2(comissao),
            custo_fixo: round2(custoFixoMensal),
            custo_variavel: round2(custoVar),
            receita_liquida: round2(receitaLiq),
            custo_total: round2(custoTotal),
            valor_liquido: round2(valorLiq),
            noites_breakeven: breakeven,
            atingiu_breakeven: breakeven !== null && noites >= breakeven,
        }
    })

    const totalFatBruto = metaAnual
    const totalComissao = totalFatBruto * COMISSAO
    const totalReceitaLiq = totalFatBruto - totalComissao
    const totalNoitesAnual = valor_liquido_mensal.reduce((s, m) => s + m.noites, 0)
    const totalCustoVar = totalNoitesAnual * quartos * CUSTO_VAR_NOITE
    const totalCustoTotal = custoFixoAnual + totalCustoVar
    const valorLiqAnual = totalReceitaLiq - totalCustoTotal
    const rentOperacional = valorImovel > 0 ? (valorLiqAnual / valorImovel) * 100 : 0
    const rentTotal = rentOperacional + valorizacaoAnual * 100

    const analise: AnaliseFinanceira = {
        parametros: {
            valor_imovel: valorImovel,
            comissao_qav_perc: "20%",
            custo_fixo_anual_perc: "3%",
            custo_fixo_anual: round2(custoFixoAnual),
            custo_fixo_mensal: round2(custoFixoMensal),
            custo_variavel_por_quarto_noite: CUSTO_VAR_NOITE,
            quartos,
        },
        valor_liquido_mensal,
        resumo_anual: {
            faturamento_bruto_anual: round2(totalFatBruto),
            comissao_qav_anual: round2(totalComissao),
            receita_liquida_anual: round2(totalReceitaLiq),
            custo_total_anual: round2(totalCustoTotal),
            custo_fixo_anual: round2(custoFixoAnual),
            custo_variavel_anual: round2(totalCustoVar),
            valor_liquido_anual: round2(valorLiqAnual),
            rentabilidade_operacional_perc: round2(rentOperacional) + "%",
            valorizacao_anual_perc: round2(valorizacaoAnual * 100) + "%",
            rentabilidade_total_anual_perc: round2(rentTotal) + "%",
        },
    }

    return { ...ctx, analiseFinanceira: analise }
}

function round2(n: number): number {
    return Number(n.toFixed(2))
}
