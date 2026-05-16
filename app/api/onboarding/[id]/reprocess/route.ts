/**
 * POST /api/onboarding/:id/reprocess
 *
 * Re-roda o pipeline de enrichment para um onboarding existente.
 * Útil quando o operador edita dados (ex.: corrigir valor do imóvel) ou
 * quando há mudança no Gemini/cálculos. Idempotente.
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getOnboarding } from "@/lib/onboarding/repository"
import { runEnrichmentInBackground } from "@/lib/onboarding/pipeline"
import type { JestorPayload } from "@/lib/onboarding/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const row = await getOnboarding(params.id)
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    runEnrichmentInBackground(
        row.id,
        row.idpropriedade,
        row.jestor_payload as unknown as JestorPayload
    )

    return NextResponse.json({
        success: true,
        message: "Reprocessamento disparado em background",
    })
}
