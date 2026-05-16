/**
 * GET /api/onboarding/:id/pricing-pdf
 *
 * Renderiza o Estudo de Rentabilidade em PDF on-the-fly a partir dos dados
 * já gravados em property_onboarding. Não precisa do Drive: gera a cada
 * request. Usado pela tab "Estudo" do drawer (iframe inline).
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getOnboarding } from "@/lib/onboarding/repository"
import { htmlToPdfBuffer } from "@/lib/onboarding/pdf"
import { renderPricingStudyHtml } from "@/lib/onboarding/templates/pricing-study"
import type {
    AnaliseFinanceira,
    BqHydratedProperty,
    JestorPayload,
    MetaDistribuicaoMensal,
} from "@/lib/onboarding/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const row = await getOnboarding(params.id)
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    if (!row.property_value || !row.meta_anual || !row.meta_distribuicao_mensal || !row.analise_financeira) {
        return NextResponse.json(
            { error: "Pipeline ainda não concluído (campos do estudo ausentes)" },
            { status: 409 }
        )
    }

    const distItems =
        ((row.meta_distribuicao_mensal as { items?: MetaDistribuicaoMensal[] }).items as MetaDistribuicaoMensal[]) ||
        []

    const html = renderPricingStudyHtml({
        payload: row.jestor_payload as unknown as JestorPayload,
        bq: (row.bq_snapshot as unknown as BqHydratedProperty) || null,
        propertyValue: Number(row.property_value),
        propertyAppreciation: Number(row.property_appreciation || 0),
        metaAnual: Number(row.meta_anual),
        distribuicao: distItems,
        analise: row.analise_financeira as unknown as AnaliseFinanceira,
    })

    const pdf = await htmlToPdfBuffer(html, { landscape: false })

    return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="estudo-${row.idpropriedade}.pdf"`,
            "Cache-Control": "private, max-age=60",
        },
    })
}
