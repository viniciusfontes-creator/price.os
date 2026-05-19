/**
 * GET /api/stays/master-candidates?regionId=X&excludeListingId=Y
 *
 * Lista apartamentos elegíveis pra serem master de price-mirror (mesma region,
 * sem _idMasterApartment, types._b_main=1).
 */

import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { listMasterCandidates } from "@/lib/stays/pricing"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const regionId = req.nextUrl.searchParams.get("regionId")
    const excludeListingId = req.nextUrl.searchParams.get("excludeListingId")
    if (!regionId || !excludeListingId) {
        return NextResponse.json(
            { error: "regionId e excludeListingId obrigatórios" },
            { status: 400 },
        )
    }

    try {
        const candidates = await listMasterCandidates({ regionId, excludeListingId })
        return NextResponse.json({ candidates })
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return NextResponse.json({ error: msg }, { status: 502 })
    }
}
