/**
 * Step 17: Procura um listing Airbnb pré-existente do proprietário
 * que case com a unidade nova (proximidade ≤200m + capacidade compatível).
 *
 * Útil para já trazer histórico de mercado da própria unidade quando o
 * proprietário tinha anúncio no Airbnb antes de entrar no PMS da QAVI.
 */

import { getSupabaseAdmin } from "@/lib/supabase-server"
import type { PipelineContext } from "../types"

export interface AirbnbMatch {
    id_numerica: number
    nome_anuncio: string | null
    url_anuncio: string | null
    distancia_m: number
    hospedes_adultos: number | null
}

export async function matchAirbnb(ctx: PipelineContext): Promise<AirbnbMatch | null> {
    const supabase = getSupabaseAdmin()
    if (!supabase) return null

    const lat = Number(ctx.payload.latitude ?? ctx.bq?.latitude)
    const lng = Number(ctx.payload.longitude ?? ctx.bq?.longitude)
    const hospedes = Number(ctx.bq?._i_maxguests ?? ctx.payload.quartos) || 0

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    // Heurística com bounding box (~0.002° ≈ 220m em latitudes próximas ao equador).
    // Não usa PostGIS direto para evitar dependência de ST_DWithin no client.
    const DELTA = 0.002
    const { data, error } = await supabase
        .from("airbnb_propriedades")
        .select("id_numerica, nome_anuncio, url_anuncio, latitude, longitude, hospedes_adultos")
        .gte("latitude", lat - DELTA)
        .lte("latitude", lat + DELTA)
        .gte("longitude", lng - DELTA)
        .lte("longitude", lng + DELTA)
        .limit(50)

    if (error || !data?.length) return null

    type Row = {
        id_numerica: number | null
        nome_anuncio: string | null
        url_anuncio: string | null
        latitude: number | null
        longitude: number | null
        hospedes_adultos: number | null
    }

    const candidates = (data as Row[])
        .map((row) => {
            const d = haversineMeters(lat, lng, row.latitude ?? 0, row.longitude ?? 0)
            return { row, d }
        })
        .filter((c) => c.d <= 200)
        .filter((c) => {
            if (!hospedes) return true
            const h = c.row.hospedes_adultos ?? 0
            return Math.abs(h - hospedes) <= 1
        })
        .sort((a, b) => a.d - b.d)

    const best = candidates[0]
    if (!best) return null

    return {
        id_numerica: Number(best.row.id_numerica ?? 0),
        nome_anuncio: best.row.nome_anuncio ?? null,
        url_anuncio: best.row.url_anuncio ?? null,
        distancia_m: Math.round(best.d),
        hospedes_adultos: best.row.hospedes_adultos ?? null,
    }
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
