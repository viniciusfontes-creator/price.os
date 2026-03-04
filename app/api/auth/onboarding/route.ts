import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../[...nextauth]/route"
import { getSupabaseAdmin } from "@/lib/supabase-server"

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { tactical_level, is_pricing_sector } = body

        if (!tactical_level || is_pricing_sector === undefined) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 })
        }

        const supabase = getSupabaseAdmin()
        if (!supabase) {
            return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
        }

        const { error } = await supabase
            .from("users")
            .upsert(
                {
                    email: session.user.email.toLowerCase(),
                    name: session.user.name || null,
                    image: session.user.image || null,
                    tactical_level,
                    is_pricing_sector,
                    onboarding_completed: true,
                    last_login: new Date().toISOString(),
                },
                { onConflict: "email" }
            )

        if (error) {
            console.error("[Onboarding] Supabase error:", error)
            return NextResponse.json({ error: "Failed to save" }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}
