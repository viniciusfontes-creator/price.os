/**
 * GET  /api/onboarding/:id/pricing — retorna estado completo do pricing
 *      (snapshot + sugestões IA + aprovações + status sync).
 *
 * PUT  /api/onboarding/:id/pricing — operador salva edições da Tab Pricing.
 *      Body: { mode, mirror_source_idpropriedade?, seasons: [{ _idseason, approved_base_rate, approved_monthly_rate? }] }
 *
 * Auto-save com debounce no front: PUT é idempotente e parcial — só atualiza
 * pricing_config (não dispara apply).
 */

import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getOnboarding, updateOnboarding } from "@/lib/onboarding/repository"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface PricingConfigSeason {
    _idseason: string
    from?: string
    to?: string
    current_base_rate?: number | null
    suggested_base_rate?: number | null
    approved_base_rate?: number | null
    approved_monthly_rate?: number | null
    reason?: string
    needs_monthly_rate?: boolean
}

interface PricingConfigPayload {
    mode: "manual" | "mirror" | "keep_current"
    mirror_source_idpropriedade?: string | null
    seasons: PricingConfigSeason[]
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const row = await getOnboarding(params.id)
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    return NextResponse.json({
        idpropriedade: row.idpropriedade,
        state: row.state,
        stays_listing_id: (row as unknown as Record<string, unknown>).stays_listing_id ?? null,
        stays_region_id: (row as unknown as Record<string, unknown>).stays_region_id ?? null,
        stays_region_name: (row as unknown as Record<string, unknown>).stays_region_name ?? null,
        snapshot_seasons:
            ((row as unknown as Record<string, unknown>).stays_snapshot_seasons as { items?: unknown[] } | null)
                ?.items ?? [],
        pricing_config: (row as unknown as Record<string, unknown>).pricing_config ?? null,
        sync: {
            status: (row as unknown as Record<string, unknown>).stays_sync_status ?? "pending",
            synced_at: (row as unknown as Record<string, unknown>).stays_synced_at ?? null,
            errors: (row as unknown as Record<string, unknown>).stays_sync_errors ?? null,
        },
    })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const row = await getOnboarding(params.id)
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    let body: PricingConfigPayload
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 })
    }

    if (!body.mode || !Array.isArray(body.seasons)) {
        return NextResponse.json(
            { error: "Campos obrigatórios: mode, seasons[]" },
            { status: 400 },
        )
    }

    // Merge: preserva snapshot original (current_base_rate, suggested) e
    // sobrescreve apenas approved_*.
    const existing = (row as unknown as Record<string, unknown>).pricing_config as
        | { seasons?: PricingConfigSeason[] }
        | null
    const bySeasonId = new Map<string, PricingConfigSeason>()
    for (const s of existing?.seasons ?? []) bySeasonId.set(s._idseason, s)
    for (const s of body.seasons) {
        const prev = bySeasonId.get(s._idseason) ?? { _idseason: s._idseason }
        bySeasonId.set(s._idseason, {
            ...prev,
            approved_base_rate: s.approved_base_rate ?? null,
            approved_monthly_rate: s.approved_monthly_rate ?? null,
        })
    }

    const merged: PricingConfigPayload = {
        mode: body.mode,
        mirror_source_idpropriedade: body.mirror_source_idpropriedade ?? null,
        seasons: Array.from(bySeasonId.values()),
    }

    await updateOnboarding(params.id, {
        pricing_config: merged as unknown as Record<string, unknown>,
    } as Record<string, unknown>)

    return NextResponse.json({ success: true, updated_at: new Date().toISOString() })
}
