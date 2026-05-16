/**
 * GET /api/onboarding/:id  → retorna registro completo + log de eventos
 * PATCH /api/onboarding/:id → atualiza campos manuais (notes, operator_email)
 * DELETE /api/onboarding/:id → arquiva (state=arquivada)
 */

import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import {
    getOnboarding,
    listEvents,
    transitionState,
    updateOnboarding,
} from "@/lib/onboarding/repository"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function requireSession() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), email: null }
    }
    return { error: null, email: session.user.email }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireSession()
    if (auth.error) return auth.error

    const row = await getOnboarding(params.id)
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    const events = await listEvents(params.id)
    return NextResponse.json({ success: true, data: row, events })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireSession()
    if (auth.error) return auth.error

    let body: { notes?: string; operator_email?: string } = {}
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 })
    }

    const row = await getOnboarding(params.id)
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    await updateOnboarding(params.id, {
        notes: body.notes ?? row.notes,
        operator_email: body.operator_email ?? row.operator_email,
    })

    return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireSession()
    if (auth.error) return auth.error

    const row = await getOnboarding(params.id)
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    await transitionState(params.id, row.idpropriedade, "arquivada", {
        notes: `Arquivado por ${auth.email} em ${new Date().toISOString()}`,
    })
    return NextResponse.json({ success: true })
}
