/**
 * POST /api/onboarding/:id/activate
 *
 * Ativa a unidade — cria os derivados aprovados pelo operador (basket,
 * baserate) e marca a unidade como visível nas Views.
 *
 * Body (opcional):
 *   {
 *     createBasket?: boolean,           // default true
 *     approvedBaserate?: number | null, // default = suggested_baserate
 *     selectedBasketItemIds?: number[]  // default = todos os suggested
 *   }
 */

import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { activateUnit } from "@/lib/onboarding/steps/18-activate-unit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: {
        createBasket?: boolean
        approvedBaserate?: number | null
        selectedBasketItemIds?: number[]
    } = {}
    try {
        body = await req.json()
    } catch {
        // body opcional
    }

    const result = await activateUnit({
        onboardingId: params.id,
        operatorEmail: session.user.email,
        createBasket: body.createBasket ?? true,
        approvedBaserate: body.approvedBaserate,
        selectedBasketItemIds: body.selectedBasketItemIds,
    })

    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, basketId: result.basketId })
}
