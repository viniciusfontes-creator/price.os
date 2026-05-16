/**
 * GET /api/onboarding/:id/pitchdeck-pdf
 *
 * Renderiza o Pitchdeck Qavi.imob (7 slides A4 landscape) on-the-fly.
 * Usado pela tab "Pitchdeck" do drawer.
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getOnboarding } from "@/lib/onboarding/repository"
import { htmlToPdfBuffer } from "@/lib/onboarding/pdf"
import { renderOwnerPitchdeckHtml } from "@/lib/onboarding/templates/owner-pitchdeck"

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

    const html = renderOwnerPitchdeckHtml({
        ownerName: row.owner_name || "Proprietário",
        nomePropriedade:
            row.owner_name != null
                ? (row.bq_snapshot as { nomePropriedade?: string } | null)?.nomePropriedade ||
                  (row.jestor_payload as { propriedade?: string }).propriedade ||
                  row.idpropriedade
                : (row.jestor_payload as { propriedade?: string }).propriedade || row.idpropriedade,
        idPropriedade: row.idpropriedade,
    })

    const pdf = await htmlToPdfBuffer(html, { landscape: true })

    return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="pitchdeck-${row.idpropriedade}.pdf"`,
            "Cache-Control": "private, max-age=60",
        },
    })
}
