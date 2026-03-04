import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../[...nextauth]/route"
import { getSupabaseAdmin } from "@/lib/supabase-server"

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ onboarding_completed: false })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
        // If no Supabase, skip onboarding check
        return NextResponse.json({ onboarding_completed: true })
    }

    const { data } = await supabase
        .from("users")
        .select("onboarding_completed")
        .eq("email", session.user.email.toLowerCase())
        .single()

    return NextResponse.json({
        onboarding_completed: data?.onboarding_completed ?? false,
    })
}
