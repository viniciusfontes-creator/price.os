/**
 * GET /api/admin/stays-webhooks/[id] — detalhe de um evento
 * POST /api/admin/stays-webhooks/[id]/reset — limpa processed_at + processing_error
 *   (para reprocessar depois que tivermos um processor real)
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { requireAdminSession } from "@/lib/stays/admin-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })

    const { data, error } = await supabase
        .from("stays_webhook_events")
        .select("*")
        .eq("id", params.id)
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })

    let body: { action?: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 })
    }

    if (body.action === "reset") {
        const { data, error } = await supabase
            .from("stays_webhook_events")
            .update({ processed_at: null, processing_error: null })
            .eq("id", params.id)
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, event: data })
    }

    return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 })
}
