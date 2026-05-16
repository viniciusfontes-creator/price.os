/**
 * GET /api/onboarding/baskets
 *
 * Lista as competitor_baskets existentes (para o select de "Adicionar a
 * basket existente" na tab Sugestões).
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getSupabaseAdmin } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: "DB indisponível" }, { status: 503 })

    const { data, error } = await supabase
        .from("competitor_baskets")
        .select("id, name, internal_property_id")
        .order("name", { ascending: true })
        .limit(200)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, data })
}
