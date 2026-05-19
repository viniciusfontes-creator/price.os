/**
 * Step 01d: Sugere a Region (regra de preço) da Stays para a unidade nova.
 *
 * v2 (2026-05-18): consulta o vínculo persistido em `seasonalities.stays_region_id`
 * via `seasonality_pracas`. Antes era hardcoded em PRACA_TO_REGION_NAME — agora a
 * operação edita em /system/sazonalidades sem precisar de PR.
 *
 * Fallback: se a praça não tem sazonalidade ou a sazonalidade não tem region
 * vinculada, retorna confidence="none" e o operador escolhe na UI.
 */

import { getSupabaseAdmin } from "@/lib/supabase-server"
import { listPriceRegions } from "@/lib/stays/pricing"
import type { PipelineContext } from "../types"

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

    const supabase = getSupabaseAdmin()
    if (!supabase) {
        return {
            region_id: null,
            region_name: null,
            confidence: "none",
            reason: "Supabase indisponível",
        }
    }

    // 1. Praça → sazonalidade
    const { data: pracaRow } = await supabase
        .from("seasonality_pracas")
        .select("seasonality_id")
        .eq("praca", praca)
        .maybeSingle()

    if (!pracaRow?.seasonality_id) {
        return {
            region_id: null,
            region_name: null,
            confidence: "none",
            reason: `Praça "${praca}" não tem sazonalidade cadastrada — configure em /system/sazonalidades`,
        }
    }

    // 2. Sazonalidade → region vinculada
    const { data: seasonality } = await supabase
        .from("seasonalities")
        .select("name, stays_region_id, stays_region_name")
        .eq("id", pracaRow.seasonality_id)
        .single()

    if (!seasonality?.stays_region_id) {
        return {
            region_id: null,
            region_name: seasonality?.stays_region_name ?? null,
            confidence: "none",
            reason: `Sazonalidade "${seasonality?.name ?? "?"}" não tem region Stays vinculada — configure em /system/sazonalidades`,
        }
    }

    // 3. Validar que a region ainda existe na Stays (rede + cache fresh)
    try {
        const regions = await listPriceRegions()
        const match = regions.find((r) => r._id === seasonality.stays_region_id)
        if (!match) {
            return {
                region_id: seasonality.stays_region_id,
                region_name: seasonality.stays_region_name,
                confidence: "low",
                reason: `Region ${seasonality.stays_region_id} (cache: "${seasonality.stays_region_name}") não está mais ativa na Stays — verificar cadastro`,
            }
        }
        return {
            region_id: match._id,
            region_name: match.name,
            confidence: "high",
            reason: `Vinculada via sazonalidade "${seasonality.name}" (praça "${praca}")`,
        }
    } catch (e) {
        return {
            region_id: seasonality.stays_region_id,
            region_name: seasonality.stays_region_name,
            confidence: "medium",
            reason: `Falha ao validar na Stays — usando cache (${(e as Error).message})`,
        }
    }
}
