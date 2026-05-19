/**
 * GET /api/admin/sazonalidades
 *
 * Lista todas as sazonalidades do Price.OS com:
 *   - praças vinculadas (seasonality_pracas)
 *   - region atual da Stays (stays_region_id + nome cache)
 *   - lista de regions disponíveis para o dropdown
 *   - quantidade de periods configurados
 *
 * Auth: NextAuth (gated por requireAdminSession).
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { requireAdminSession } from "@/lib/stays/admin-auth"
import { listPriceRegions } from "@/lib/stays/pricing"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface SeasonalityRow {
    id: string
    name: string
    stays_region_id: string | null
    stays_region_name: string | null
    pracas: string[]
    period_count: number
}

export async function GET(_req: NextRequest) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })

    // Sazonalidades base
    const { data: seasonalitiesRaw, error: e1 } = await supabase
        .from("seasonalities")
        .select("id, name, stays_region_id, stays_region_name")
        .order("name")
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

    // Praças por sazonalidade
    const { data: pracas, error: e2 } = await supabase
        .from("seasonality_pracas")
        .select("seasonality_id, praca")
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    // Contagem de periods por sazonalidade
    const { data: periods, error: e3 } = await supabase
        .from("seasonality_periods")
        .select("seasonality_id")
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })

    const pracaBySeason = new Map<string, string[]>()
    for (const p of pracas ?? []) {
        const arr = pracaBySeason.get(p.seasonality_id) ?? []
        arr.push(p.praca)
        pracaBySeason.set(p.seasonality_id, arr)
    }

    const countBySeason = new Map<string, number>()
    for (const p of periods ?? []) {
        countBySeason.set(p.seasonality_id, (countBySeason.get(p.seasonality_id) ?? 0) + 1)
    }

    const seasonalities: SeasonalityRow[] = (seasonalitiesRaw ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        stays_region_id: s.stays_region_id,
        stays_region_name: s.stays_region_name,
        pracas: pracaBySeason.get(s.id) ?? [],
        period_count: countBySeason.get(s.id) ?? 0,
    }))

    // Regions disponíveis (Stays API)
    let regions: Array<{ _id: string; name: string }> = []
    let regionsError: string | null = null
    try {
        regions = await listPriceRegions()
    } catch (e) {
        regionsError = (e as Error).message
    }

    return NextResponse.json({ seasonalities, regions, regionsError })
}
