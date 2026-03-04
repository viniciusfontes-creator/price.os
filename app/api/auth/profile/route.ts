import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../[...nextauth]/route"
import { getSupabaseAdmin } from "@/lib/supabase-server"

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
        return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
    }

    const { data, error } = await supabase
        .from("users")
        .select("tactical_level, is_pricing_sector, onboarding_completed, role")
        .eq("email", session.user.email.toLowerCase())
        .single()

    if (error || !data) {
        return NextResponse.json({ tactical_level: null, is_pricing_sector: null })
    }

    return NextResponse.json(data)
}
