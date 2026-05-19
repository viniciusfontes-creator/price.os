/**
 * POST /api/onboarding/:id/set-price-mirror
 *
 * Vincula a listing como FILHO de outra (price-mirror). O preço passa a
 * espelhar o master continuamente.
 *
 * Body: { masterListingId: string, masterName?: string }
 */

import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getOnboarding, logEvent, updateOnboarding } from "@/lib/onboarding/repository"
import { linkPriceMirror } from "@/lib/stays/pricing"
import { isDryRun } from "@/lib/onboarding/constants"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    const operatorEmail = session?.user?.email
    if (!operatorEmail) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as {
        masterListingId?: string
        masterName?: string
    }
    const masterListingId = body.masterListingId?.trim()
    if (!masterListingId) {
        return NextResponse.json(
            { error: "masterListingId obrigatório" },
            { status: 400 },
        )
    }

    const row = await getOnboarding(params.id)
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    const stays_listing_id = (row as unknown as Record<string, unknown>).stays_listing_id as
        | string
        | null
    if (!stays_listing_id) {
        return NextResponse.json(
            { error: "stays_listing_id ausente — refaça o enrichment" },
            { status: 422 },
        )
    }
    if (stays_listing_id === masterListingId) {
        return NextResponse.json(
            { error: "A unidade não pode ser master de si mesma" },
            { status: 400 },
        )
    }

    const dryRun = isDryRun()
    await logEvent(params.id, row.idpropriedade, "stays_mirror_link_started", {
        operator: operatorEmail,
        master_listing_id: masterListingId,
        master_name: body.masterName ?? null,
        dry_run: dryRun,
    })

    try {
        await linkPriceMirror({
            listingId: stays_listing_id,
            masterListingId,
            reltype: "fill",
            dryRun,
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await logEvent(params.id, row.idpropriedade, "stays_mirror_link_failed", {
            error: msg,
            dry_run: dryRun,
        })
        return NextResponse.json(
            { error: `Falha ao vincular espelho: ${msg}` },
            { status: 502 },
        )
    }

    await updateOnboarding(params.id, {
        stays_sync_status: dryRun ? "dry_run" : "synced",
        stays_synced_at: new Date().toISOString(),
    } as Record<string, unknown>)
    await logEvent(params.id, row.idpropriedade, "stays_mirror_linked", {
        master_listing_id: masterListingId,
        master_name: body.masterName ?? null,
        dry_run: dryRun,
    })

    return NextResponse.json({
        success: true,
        dry_run: dryRun,
        master_listing_id: masterListingId,
    })
}
