import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getSupabaseAdmin } from "@/lib/supabase-server"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get("status")
  const praca = url.searchParams.get("praca")
  const confianca = url.searchParams.get("confianca")
  const saude = url.searchParams.get("saude")
  const periodo = url.searchParams.get("periodo")
  const limit = Math.min(Number(url.searchParams.get("limit") || 500), 1000)

  let q = supabase
    .from("pricing_ajustes_propostos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (status && status !== "todos") q = q.eq("status", status)
  if (praca) q = q.eq("praca", praca)
  if (confianca) q = q.eq("confianca", confianca)
  if (saude) q = q.eq("saude", saude)
  if (periodo) q = q.eq("periodo_nome", periodo)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
