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
} from "@/lib/onboarding/repository"
import { applyEdits, type EditableFields } from "@/lib/onboarding/recalc"

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

    let body: EditableFields = {}
    try {
        body = (await req.json()) as EditableFields
    } catch {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 })
    }

    // Validação mínima: campos numéricos precisam ser positivos quando enviados
    const numericChecks: Array<[keyof EditableFields, number]> = [
        ["property_value", 1],
        ["meta_anual", 0],
        ["quartos", 1],
    ]
    for (const [field, minimum] of numericChecks) {
        const v = body[field]
        if (v != null && (Number.isNaN(Number(v)) || Number(v) < minimum)) {
            return NextResponse.json(
                { error: `Campo ${field} inválido: deve ser número ≥ ${minimum}` },
                { status: 400 }
            )
        }
    }
    if (body.property_appreciation != null) {
        const v = Number(body.property_appreciation)
        if (Number.isNaN(v) || v < 0 || v > 1) {
            return NextResponse.json(
                {
                    error:
                        "property_appreciation inválido: use decimal entre 0 e 1 (ex.: 0.08 para 8% a.a.)",
                },
                { status: 400 }
            )
        }
    }

    const report = await applyEdits(params.id, body, auth.email!)
    if (!report.ok) {
        return NextResponse.json({ error: report.error || "Falha ao aplicar" }, { status: 400 })
    }
    return NextResponse.json({ success: true, ...report })
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
