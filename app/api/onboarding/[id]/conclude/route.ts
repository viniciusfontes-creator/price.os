/**
 * POST /api/onboarding/:id/conclude
 *
 * Aciona explicitamente o "Concluir" — Vitor aprova → dispara Jestor,
 * e-mail, Slack (Estudo+Pitchdeck), ativa unidade. Idempotente.
 *
 * Body (opcional):
 *   { createBasket?: boolean, approvedBaserate?: number | null }
 */

import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { runConclusion } from "@/lib/onboarding/conclude"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: { createBasket?: boolean; approvedBaserate?: number | null } = {}
    try {
        body = await req.json()
    } catch {
        // body opcional
    }

    const r = await runConclusion({
        onboardingId: params.id,
        operatorEmail: session.user.email,
        createBasket: body.createBasket ?? true,
        approvedBaserate: body.approvedBaserate,
    })
    if (!r.ok) {
        return NextResponse.json({ error: r.error || "Falha" }, { status: 500 })
    }
    return NextResponse.json({ success: true, actions: r.actions, basketId: r.basketId })
}
