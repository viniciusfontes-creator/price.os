/**
 * POST /api/onboarding/webhook
 *
 * Receiver da automação Jestor (botão "Enviar para Precificação").
 * Substitui o webhook n8n https://n8n.quartoavista.com.br/webhook/jestor.
 *
 * Payload esperado (mesmo shape que a Jestor já envia hoje):
 *   {
 *     recordid: "581",
 *     idpropriedade: "JO01J",          ← obrigatório
 *     propriedade: "AL - ...",          ← nome interno
 *     rotulo: "Beach House ...",        ← título de marketing
 *     proprietario: "Nelson Fernandes",
 *     quartos: "3",
 *     latitude: "-9.16...",
 *     longitude: "-35.29...",
 *     localidade: "Milagres"
 *   }
 *
 * Auth: header `Authorization: Bearer <ONBOARDING_WEBHOOK_TOKEN>`
 *
 * Comportamento idempotente: se idpropriedade já existe em property_onboarding,
 * retorna 200 sem reenfileirar.
 *
 * F1: apenas grava o registro em estado 'recebida' e loga o evento.
 *     O pipeline de enrichment (steps 2-19) entra na F2.
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface JestorPayload {
    recordid?: string | number
    idpropriedade?: string
    propriedade?: string
    rotulo?: string
    proprietario?: string
    quartos?: string | number
    latitude?: string | number
    longitude?: string | number
    localidade?: string
}

function verifyAuth(req: NextRequest): boolean {
    const expected = process.env.ONBOARDING_WEBHOOK_TOKEN
    if (!expected) {
        // Em dev, se a env não estiver setada, deixa passar.
        // Em produção, sem o token o endpoint fica 401 por segurança.
        return process.env.NODE_ENV !== "production"
    }
    const auth = req.headers.get("authorization") || ""
    return auth === `Bearer ${expected}`
}

export async function POST(req: NextRequest) {
    if (!verifyAuth(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let payload: JestorPayload
    try {
        payload = await req.json()
    } catch {
        return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 })
    }

    const idpropriedade = String(payload.idpropriedade || "").trim()
    if (!idpropriedade) {
        return NextResponse.json(
            { error: "Campo obrigatório ausente: idpropriedade" },
            { status: 400 }
        )
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
        return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
    }

    // Idempotência: se já existe, retorna o registro existente sem alterar.
    const { data: existing } = await supabase
        .from("property_onboarding")
        .select("id, state, created_at")
        .eq("idpropriedade", idpropriedade)
        .maybeSingle()

    if (existing) {
        return NextResponse.json({
            success: true,
            duplicate: true,
            id: existing.id,
            state: existing.state,
            received_at: existing.created_at,
        })
    }

    // Insere novo onboarding em estado 'recebida'
    const jestorRecordId = payload.recordid != null ? String(payload.recordid) : null

    const { data: inserted, error: insertErr } = await supabase
        .from("property_onboarding")
        .insert({
            idpropriedade,
            jestor_record_id: jestorRecordId,
            jestor_payload: payload,
            state: "recebida",
        })
        .select("id, created_at")
        .single()

    if (insertErr || !inserted) {
        console.error("[onboarding/webhook] insert error:", insertErr)
        return NextResponse.json(
            { error: "Falha ao registrar onboarding", details: insertErr?.message },
            { status: 500 }
        )
    }

    // Log do evento (best-effort, não bloqueia resposta)
    await supabase.from("property_onboarding_events").insert({
        onboarding_id: inserted.id,
        idpropriedade,
        event_type: "received",
        payload: { source: "jestor", body: payload },
    })

    // F2: aqui dispararemos o pipeline em background via waitUntil()

    return NextResponse.json({
        success: true,
        id: inserted.id,
        idpropriedade,
        state: "recebida",
        received_at: inserted.created_at,
    }, { status: 201 })
}
