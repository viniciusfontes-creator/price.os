/**
 * POST /api/stays/webhook
 *
 * Receiver de notificações da Stays (App Center > Stays API > External API).
 * URL pública configurada em "Link de notificações" na conta Price-OS.
 *
 * Auth: Stays envia Basic auth com o par client_id:client_secret cadastrado.
 *       Validado em lib/stays/webhook-auth.ts.
 *
 * Como a Stays não publica oficialmente o schema dos webhooks, o receiver
 * grava o payload bruto em stays_webhook_events. Refinamos o parsing
 * conforme os eventos reais chegarem (reservas criadas/editadas, mudanças
 * de calendário, etc.).
 *
 * Modo "Individual" (configurado no App Center): a Stays só dispara para
 * listings explicitamente assinados. Modo "Global" envia tudo.
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { validateStaysWebhook } from "@/lib/stays/webhook-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function inferEventType(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null
    const p = payload as Record<string, unknown>
    if (typeof p.action === "string") return p.action
    if (typeof p.event === "string") return p.event
    if (typeof p.type === "string") return p.type
    return null
}

function inferEntityId(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null
    const p = payload as Record<string, unknown>
    const candidates = [p._id, p.id, p.reservationId, p.listingId, p._idlisting, p._idreservation]
    const found = candidates.find((v) => typeof v === "string" && v.length > 0)
    return (found as string) ?? null
}

export async function POST(req: NextRequest) {
    const validation = validateStaysWebhook(req)
    if (process.env.NODE_ENV === "production" && !validation.isStays) {
        return NextResponse.json(
            { error: "Unauthorized", reason: validation.reason },
            { status: 401 },
        )
    }

    let payload: unknown
    try {
        payload = await req.json()
    } catch {
        return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
        return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
    }

    const eventType = inferEventType(payload)
    const entityId = inferEntityId(payload)

    // Persistimos apenas os headers `x-stays-*` (úteis pra debug) e o signature
    // marcado, sem dados sensíveis de infra (oidc tokens, vercel internals, etc).
    const staysHeaders: Record<string, string> = {}
    req.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith("x-stays-")) {
            staysHeaders[key] = key === "x-stays-signature" ? `<${value.length}b>` : value
        }
    })

    const { data: inserted, error } = await supabase
        .from("stays_webhook_events")
        .insert({
            event_type: eventType,
            entity_id: entityId,
            payload,
            headers: {
                tenant: validation.tenant,
                stays: staysHeaders,
                source_ip: req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for"),
            },
        })
        .select("id, received_at")
        .single()

    if (error) {
        console.error("[stays/webhook] insert error:", error)
        return NextResponse.json(
            { error: "Falha ao registrar evento", details: error.message },
            { status: 500 },
        )
    }

    return NextResponse.json(
        { success: true, id: inserted?.id, event_type: eventType, entity_id: entityId },
        { status: 201 },
    )
}

/** GET para verificação manual do endpoint. */
export async function GET(req: NextRequest) {
    const v = validateStaysWebhook(req)
    return NextResponse.json({
        ok: true,
        endpoint: "stays-webhook",
        is_stays_request: v.isStays,
        tenant: v.tenant,
        timestamp: new Date().toISOString(),
    })
}
