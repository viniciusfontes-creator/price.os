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
import { verifyStaysWebhookAuth } from "@/lib/stays/webhook-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Fase de descoberta: estamos aprendendo qual esquema de auth a Stays usa
 * de fato nos webhooks. A doc não documenta — pode ser Basic, HMAC, ou nada.
 * Receber tudo, gravar metadata de auth no JSONB de headers, e diagnosticar
 * a partir dos payloads reais. Sem side-effect além de gravar no banco.
 */
const WEBHOOK_OPEN_MODE = true

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
    const authOk = verifyStaysWebhookAuth(req)
    if (!authOk && !WEBHOOK_OPEN_MODE) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    // Captura todos os headers pra descobrir o esquema de auth que a Stays usa.
    // Sanitizamos o Authorization para não persistir o secret cru.
    const allHeaders: Record<string, string> = {}
    req.headers.forEach((value, key) => {
        if (key.toLowerCase() === "authorization") {
            allHeaders[key] = value.split(" ")[0] + " <redacted>"
        } else {
            allHeaders[key] = value
        }
    })

    const { data: inserted, error } = await supabase
        .from("stays_webhook_events")
        .insert({
            event_type: eventType,
            entity_id: entityId,
            payload,
            headers: {
                _auth_ok: authOk,
                _all: allHeaders,
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

/** GET para verificação manual do endpoint (ex.: botão "Testar" na Stays). */
export async function GET(req: NextRequest) {
    const authed = verifyStaysWebhookAuth(req)
    return NextResponse.json({
        ok: true,
        endpoint: "stays-webhook",
        authenticated: authed,
        timestamp: new Date().toISOString(),
    })
}
