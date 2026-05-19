/**
 * GET /api/stays/price-regions
 *
 * Lista todas as price-regions ativas do PMS Stays. Usado pelo dropdown
 * de "Trocar região" no tab Pricing do onboarding.
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { listPriceRegions } from "@/lib/stays/pricing"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const regions = await listPriceRegions()
        return NextResponse.json({ regions })
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return NextResponse.json({ error: msg }, { status: 502 })
    }
}
