/**
 * Step 14 (Price.OS exclusivo, não existe no n8n):
 * Sugere uma basket de concorrentes via RPC `buscar_concorrentes_v3`.
 *
 * Critério: top-N por proximidade dentro do raio padrão (10km), capacidade
 * compatível com `_i_maxguests`/quartos da unidade.
 */

import { getSupabaseAdmin } from "@/lib/supabase-server"
import type { PipelineContext } from "../types"

export interface BasketSuggestion {
    items: Array<{
        id_numerica: number
        nome_anuncio: string | null
        url_anuncio: string | null
        distancia_km: number | null
        preco_por_noite: number | null
        hospedes_adultos: number | null
        latitude: number | null
        longitude: number | null
    }>
    raio_km: number
    hospedes_alvo: number
}

const RAIO_KM = 5
const TOP_N = 10

export async function suggestBasket(ctx: PipelineContext): Promise<BasketSuggestion | null> {
    const supabase = getSupabaseAdmin()
    if (!supabase) return null

    const lat = Number(ctx.payload.latitude ?? ctx.bq?.latitude) || null
    const lng = Number(ctx.payload.longitude ?? ctx.bq?.longitude) || null
    const hospedes =
        Number(ctx.bq?._i_maxguests ?? ctx.payload.quartos) || 2

    if (lat == null || lng == null) return null

    const { data, error } = await supabase.rpc("buscar_concorrentes_v3", {
        p_latitude: lat,
        p_longitude: lng,
        p_raio_km: RAIO_KM,
        p_hospedes: hospedes,
    })

    if (error) {
        console.error("[onboarding/suggest-basket] RPC error:", error)
        return null
    }

    type RpcItem = {
        id_numerica?: number
        nome_anuncio?: string | null
        url_anuncio?: string | null
        distancia_km?: number | null
        preco_por_noite?: number | null
        hospedes_adultos?: number | null
        latitude?: number | null
        longitude?: number | null
    }

    const sorted = ((data || []) as RpcItem[])
        .slice()
        .sort((a, b) => (a.distancia_km ?? 999) - (b.distancia_km ?? 999))
        .slice(0, TOP_N)
        .map((r) => ({
            id_numerica: Number(r.id_numerica ?? 0),
            nome_anuncio: r.nome_anuncio ?? null,
            url_anuncio: r.url_anuncio ?? null,
            distancia_km: r.distancia_km ?? null,
            preco_por_noite: r.preco_por_noite ?? null,
            hospedes_adultos: r.hospedes_adultos ?? null,
            latitude: r.latitude ?? null,
            longitude: r.longitude ?? null,
        }))

    return { items: sorted, raio_km: RAIO_KM, hospedes_alvo: hospedes }
}
