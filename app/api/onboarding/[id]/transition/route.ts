/**
 * POST /api/onboarding/:id/transition
 *
 * Move o card entre colunas do Kanban via drag-and-drop. Aplica regras de
 * TRANSITIONS — bloqueia destinos inválidos com 422 e mensagem do motivo.
 *
 * Body: { to: OnboardingState }
 *
 * Casos especiais:
 *   - fila → processamento_ia: também dispara `runEnrichmentInBackground`
 *     (operador antecipou o processamento).
 *   - aprovacao → concluido: NÃO usar este endpoint — usar /conclude.
 *     Mas se chegar aqui, redirecionamos pra runConclusion pra evitar que
 *     o operador chegue em "concluido" sem disparar email/Slack/Jestor.
 *   - * → arquivada: sem efeitos colaterais além da transição.
 */

import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getOnboarding, transitionState } from "@/lib/onboarding/repository"
import {
    canTransitionManually,
    transitionReason,
} from "@/lib/onboarding/transitions"
import { runEnrichmentInBackground } from "@/lib/onboarding/pipeline"
import { runConclusion } from "@/lib/onboarding/conclude"
import { invalidateOnboardingExcludeCache } from "@/lib/onboarding/visibility"
import type { JestorPayload, OnboardingState } from "@/lib/onboarding/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

const VALID_STATES = new Set<OnboardingState>([
    "fila",
    "processamento_ia",
    "revisao",
    "aprovacao",
    "concluido",
    "arquivada",
])

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: { to?: string } = {}
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 })
    }

    const to = body.to as OnboardingState | undefined
    if (!to || !VALID_STATES.has(to)) {
        return NextResponse.json({ error: "Destino inválido" }, { status: 400 })
    }

    const row = await getOnboarding(params.id)
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    const from = row.state as OnboardingState
    if (from === to) {
        return NextResponse.json({ success: true, noop: true })
    }

    if (!canTransitionManually(from, to)) {
        return NextResponse.json(
            {
                error: "Transição não permitida",
                reason: transitionReason(from, to) || `${from} → ${to} bloqueada pelas regras`,
            },
            { status: 422 }
        )
    }

    // Casos especiais
    if (from === "fila" && to === "processamento_ia") {
        // Operador antecipou: marca state e dispara o pipeline em bg.
        runEnrichmentInBackground(
            row.id,
            row.idpropriedade,
            row.jestor_payload as unknown as JestorPayload
        )
        // runEnrichment já faz transitionState dentro dele, mas faz cedo
        // pra evitar race com leituras do kanban.
        return NextResponse.json({ success: true, message: "Pipeline disparado" })
    }

    if (from === "aprovacao" && to === "concluido") {
        // Drag manual disparando conclusão — redireciona pra runConclusion
        // pra garantir disparo de email/Slack/Jestor e criação de basket.
        const r = await runConclusion({
            onboardingId: row.id,
            operatorEmail: session.user.email,
            createBasket: true,
        })
        if (!r.ok) {
            return NextResponse.json({ error: r.error || "Falha ao concluir" }, { status: 500 })
        }
        return NextResponse.json({ success: true, actions: r.actions, basketId: r.basketId })
    }

    // Transição simples
    const extra: Record<string, unknown> = {}
    if (to === "revisao") {
        // Vitor solicitou alterações → reinicia o relógio dos 48h
        extra.revisao_since = new Date().toISOString()
    }
    await transitionState(row.id, row.idpropriedade, to, extra)
    if (to === "arquivada" || to === "concluido") {
        invalidateOnboardingExcludeCache()
    }

    return NextResponse.json({ success: true })
}
