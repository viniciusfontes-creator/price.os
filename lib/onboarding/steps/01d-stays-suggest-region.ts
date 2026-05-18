/**
 * Step 01d: Sugere a Region (regra de preço) provável pra unidade nova.
 *
 * Heurística (em ordem de preferência):
 *   1. Se a listing já tem seasons no snapshot, descobrir a region via UI Stays
 *      é impossível direto via API — mas podemos inferir pelo padrão do nome
 *      do `Season_Nome` (tabela warehouse). Por enquanto, usar fallback abaixo.
 *   2. Mapear praça do BQ → region pelo prefixo do nome:
 *        "Milagres" / "São Miguel dos Milagres" → "[Short Stay] - Rota Milagres"
 *        "Pipa" / "Tibau do Sul"               → "[Short Stay] - Pipa e proximidades"
 *        ...
 *   3. Em último caso, retorna null (operador escolhe na UI).
 *
 * Não falha o pipeline se não conseguir mapear — apenas marca null e
 * deixa a decisão pro operador na tab Pricing.
 */

import { listPriceRegions, type PriceRegion } from "@/lib/stays/pricing"
import type { PipelineContext } from "../types"

const PRACA_TO_REGION_NAME: Record<string, string> = {
    // AL
    "Maceió": "[Short Stay] Maceió",
    "Milagres": "[Short Stay] - Rota Milagres",
    "São Miguel dos Milagres": "[Short Stay] - Rota Milagres",
    "Passo de Camaragibe": "[Short Stay] - Rota Milagres",
    "Porto de Pedras": "[Short Stay] - Rota Milagres",
    "Japaratinga": "[Short Stay] - Rota Milagres",
    // RN
    "Pipa": "[Short Stay] - Pipa e proximidades",
    "Tibau do Sul": "[Short Stay] - Pipa e proximidades",
    "Jacumã": "[Short Stay] - Pipa e proximidades",
    "Natal": "[Short Stay] - Litoral Sul e Norte RN",
    "Cotovelo": "[Short Stay] - Litoral Sul e Norte RN",
    "Pirangi do Norte": "[Short Stay] - Litoral Sul e Norte RN",
    "Parnamirim": "[Short Stay] - Litoral Sul e Norte RN",
    "Nísia Floresta": "[Short Stay] - Litoral Sul e Norte RN",
    "São Miguel do Gostoso": "[Short Stay] - Litoral Sul e Norte RN",
    "Praia de Búzios": "[Short Stay] - Litoral Sul e Norte RN",
    "Praia do Riacho": "[Short Stay] - Litoral Sul e Norte RN",
    // PB
    "Bananeiras": "[Short Stay] - Bananeiras",
    "João Pessoa": "[Short Stay] - João Pessoa e proximidades",
    "Cabedelo": "[Short Stay] - João Pessoa e proximidades",
}

export interface SuggestRegionResult {
    region_id: string | null
    region_name: string | null
    confidence: "high" | "medium" | "low" | "none"
    reason: string
}

export async function staysSuggestRegion(ctx: PipelineContext): Promise<SuggestRegionResult> {
    const praca = ctx.bq?.praca || ctx.payload.localidade
    if (!praca) {
        return {
            region_id: null,
            region_name: null,
            confidence: "none",
            reason: "Praça não identificada no payload nem no BQ",
        }
    }

    const targetName = PRACA_TO_REGION_NAME[praca]
    if (!targetName) {
        return {
            region_id: null,
            region_name: null,
            confidence: "none",
            reason: `Praça "${praca}" não mapeada — operador precisa escolher manualmente`,
        }
    }

    let regions: PriceRegion[]
    try {
        regions = await listPriceRegions()
    } catch (e) {
        return {
            region_id: null,
            region_name: targetName,
            confidence: "low",
            reason: `Falha ao listar regions na Stays: ${(e as Error).message}. Nome sugerido pelo mapping local.`,
        }
    }

    const match = regions.find((r) => r.name === targetName)
    if (!match) {
        return {
            region_id: null,
            region_name: targetName,
            confidence: "low",
            reason: `Region "${targetName}" não encontrada nas regions ativas da Stays — verificar cadastro`,
        }
    }

    return {
        region_id: match._id,
        region_name: match.name,
        confidence: "high",
        reason: `Mapeado por praça "${praca}" → "${targetName}"`,
    }
}
