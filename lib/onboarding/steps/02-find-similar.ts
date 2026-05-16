/**
 * Step 2: Busca imóveis similares via RPC Supabase buscar_imoveis_semelhantes.
 *
 * RPC signature:
 *   buscar_imoveis_semelhantes(p_lat, p_long, p_area, p_quartos, p_raio_km=5)
 *
 * Como o payload da Jestor não traz área, usamos o default AREA_PADRAO_M2.
 * Resultado é uma lista de imóveis próximos com valor estimado, m², quartos,
 * valorização e séries mensais (analysisJSON).
 */

import { getSupabaseAdmin } from "@/lib/supabase-server"
import { ONBOARDING_RULES } from "../constants"
import type { PipelineContext, SimilarProperty } from "../types"

interface RpcRow {
    valor_imovel?: number | null
    "metros quadrados"?: number | null
    quartos?: number | null
    valorizacao_percentual?: number | null
    analysisJSON?: {
        monthlyDailyRate?: Record<string, number>
        monthlyOccupancy?: Record<string, number>
    } | null
    [k: string]: unknown
}

export async function findSimilar(ctx: PipelineContext): Promise<PipelineContext> {
    const supabase = getSupabaseAdmin()
    if (!supabase) throw new Error("Supabase admin client unavailable")

    const lat = toNumber(ctx.payload.latitude) ?? ctx.bq?.latitude ?? null
    const lng = toNumber(ctx.payload.longitude) ?? ctx.bq?.longitude ?? null
    const quartos =
        toNumber(ctx.payload.quartos) ??
        ctx.bq?._i_rooms ??
        ctx.bq?._i_maxguests ??
        null

    if (lat == null || lng == null || quartos == null) {
        // Sem coordenadas/quartos não dá pra rodar a RPC — devolve lista vazia.
        return { ...ctx, similar: [] }
    }

    const { data, error } = await supabase.rpc("buscar_imoveis_semelhantes", {
        p_lat: lat,
        p_long: lng,
        p_area: ONBOARDING_RULES.AREA_PADRAO_M2,
        p_quartos: quartos,
        p_raio_km: ONBOARDING_RULES.RAIO_BUSCA_SIMILARES_KM,
    })

    if (error) {
        console.error("[onboarding/find-similar] RPC error:", error)
        return { ...ctx, similar: [] }
    }

    const similar: SimilarProperty[] = ((data || []) as RpcRow[]).map((row) => ({
        valor_imovel: toNumber(row.valor_imovel),
        metros_quadrados: toNumber(row["metros quadrados"]),
        quartos: toNumber(row.quartos),
        valorizacao_percentual: toNumber(row.valorizacao_percentual),
        monthlyDailyRate: row.analysisJSON?.monthlyDailyRate,
        monthlyOccupancy: row.analysisJSON?.monthlyOccupancy,
    }))

    return { ...ctx, similar }
}

function toNumber(v: unknown): number | null {
    if (v == null || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}
