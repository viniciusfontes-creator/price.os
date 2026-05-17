/**
 * GET /api/admin/stays-webhooks
 *
 * Lista eventos recebidos via webhook da Stays para o monitor admin.
 * Query params:
 *   - limit:        default 50, max 200
 *   - offset:       default 0
 *   - event_type:   filtra exato
 *   - entity_id:    filtra exato
 *   - status:       "all" | "pending" | "processed" | "error" (default "all")
 *   - since:        ISO datetime (received_at >=)
 *
 * Resposta: { items: WebhookEvent[], total, stats: { pending, processed, error } }
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { requireAdminSession } from "@/lib/stays/admin-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface WebhookEventRow {
    id: string
    received_at: string
    event_type: string | null
    entity_id: string | null
    payload: unknown
    headers: unknown
    processed_at: string | null
    processing_error: string | null
}

export async function GET(req: NextRequest) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const supabase = getSupabaseAdmin()
    if (!supabase) {
        return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
    }

    const url = new URL(req.url)
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200)
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0)
    const eventType = url.searchParams.get("event_type")
    const entityId = url.searchParams.get("entity_id")
    const status = url.searchParams.get("status") ?? "all"
    const since = url.searchParams.get("since")

    let query = supabase
        .from("stays_webhook_events")
        .select("*", { count: "exact" })
        .order("received_at", { ascending: false })
        .range(offset, offset + limit - 1)

    if (eventType) query = query.eq("event_type", eventType)
    if (entityId) query = query.eq("entity_id", entityId)
    if (since) query = query.gte("received_at", since)
    if (status === "pending") query = query.is("processed_at", null).is("processing_error", null)
    if (status === "processed") query = query.not("processed_at", "is", null)
    if (status === "error") query = query.not("processing_error", "is", null)

    const { data, error, count } = await query
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Stats globais (sem filtros) para os cards no topo
    const [pendingRes, processedRes, errorRes] = await Promise.all([
        supabase
            .from("stays_webhook_events")
            .select("id", { count: "exact", head: true })
            .is("processed_at", null)
            .is("processing_error", null),
        supabase
            .from("stays_webhook_events")
            .select("id", { count: "exact", head: true })
            .not("processed_at", "is", null),
        supabase
            .from("stays_webhook_events")
            .select("id", { count: "exact", head: true })
            .not("processing_error", "is", null),
    ])

    return NextResponse.json({
        items: (data ?? []) as WebhookEventRow[],
        total: count ?? 0,
        stats: {
            pending: pendingRes.count ?? 0,
            processed: processedRes.count ?? 0,
            error: errorRes.count ?? 0,
        },
    })
}
