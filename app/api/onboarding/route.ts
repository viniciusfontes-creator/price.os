/**
 * GET /api/onboarding
 *
 * Lista cards do Kanban de onboarding. Autenticado via NextAuth.
 *
 * Query params (opcionais):
 *   ?state=recebida,em_analise   filtra por um ou mais estados (csv)
 *   ?limit=200                    default 200, max 500
 *
 * Response:
 *   {
 *     success: true,
 *     data: PropertyOnboarding[],
 *     by_state: Record<state, PropertyOnboarding[]>,
 *     counts: Record<state, number>
 *   }
 */

import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getSupabaseAdmin } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ALL_STATES = [
    "recebida",
    "em_analise",
    "estudo_pronto",
    "apresentado",
    "aguardando_aprovacao",
    "ativada",
    "arquivada",
] as const

export type OnboardingState = (typeof ALL_STATES)[number]

export interface OnboardingCard {
    id: string
    idpropriedade: string
    jestor_record_id: string | null
    state: OnboardingState
    jestor_payload: {
        propriedade?: string
        rotulo?: string
        proprietario?: string
        localidade?: string
        quartos?: string | number
    }
    owner_name: string | null
    owner_email: string | null
    property_value: number | null
    meta_anual: number | null
    pdf_url: string | null
    pitchdeck_pdf_url: string | null
    operator_email: string | null
    created_at: string
    updated_at: string
    enriched_at: string | null
    activated_at: string | null
}

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
        return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
    }

    const url = new URL(req.url)
    const stateParam = url.searchParams.get("state")
    const limitParam = url.searchParams.get("limit")
    const limit = Math.min(Math.max(parseInt(limitParam || "200", 10) || 200, 1), 500)

    let query = supabase
        .from("property_onboarding")
        .select(
            "id, idpropriedade, jestor_record_id, state, jestor_payload, owner_name, owner_email, property_value, meta_anual, pdf_url, pitchdeck_pdf_url, operator_email, created_at, updated_at, enriched_at, activated_at"
        )
        .order("created_at", { ascending: false })
        .limit(limit)

    if (stateParam) {
        const states = stateParam
            .split(",")
            .map((s) => s.trim())
            .filter((s): s is OnboardingState => (ALL_STATES as readonly string[]).includes(s))
        if (states.length > 0) query = query.in("state", states)
    }

    const { data, error } = await query
    if (error) {
        console.error("[onboarding] list error:", error)
        return NextResponse.json(
            { error: "Falha ao listar onboarding", details: error.message },
            { status: 500 }
        )
    }

    const rows = (data || []) as OnboardingCard[]

    // Agrupa por state e conta
    const by_state = Object.fromEntries(ALL_STATES.map((s) => [s, [] as OnboardingCard[]])) as Record<
        OnboardingState,
        OnboardingCard[]
    >
    const counts = Object.fromEntries(ALL_STATES.map((s) => [s, 0])) as Record<OnboardingState, number>

    for (const row of rows) {
        const s = row.state
        if (by_state[s]) {
            by_state[s].push(row)
            counts[s]++
        }
    }

    return NextResponse.json({
        success: true,
        data: rows,
        by_state,
        counts,
    })
}
