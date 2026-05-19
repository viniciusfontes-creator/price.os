/**
 * PUT /api/admin/sazonalidades/:id
 *
 * Atualiza o vínculo Sazonalidade ↔ Region Stays.
 *
 * Body: { stays_region_id: string | null }
 * Resolve o nome via listPriceRegions e grava ambos como cache.
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { requireAdminSession } from "@/lib/stays/admin-auth"
import { listPriceRegions } from "@/lib/stays/pricing"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    let body: { stays_region_id?: string | null }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })

    let stays_region_name: string | null = null
    if (body.stays_region_id) {
        try {
            const regions = await listPriceRegions()
            const match = regions.find((r) => r._id === body.stays_region_id)
            if (!match) {
                return NextResponse.json(
                    { error: `Region ${body.stays_region_id} não encontrada na Stays` },
                    { status: 422 },
                )
            }
            stays_region_name = match.name
        } catch (e) {
            return NextResponse.json(
                { error: `Falha ao validar region: ${(e as Error).message}` },
                { status: 502 },
            )
        }
    }

    const { error } = await supabase
        .from("seasonalities")
        .update({
            stays_region_id: body.stays_region_id ?? null,
            stays_region_name,
        })
        .eq("id", params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
        success: true,
        stays_region_id: body.stays_region_id ?? null,
        stays_region_name,
    })
}
