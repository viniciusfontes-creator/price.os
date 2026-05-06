import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { canApprove } from "@/lib/metas-ajustes/rbac"

const decisionSchema = z.object({
  acao: z.enum(["aprovar", "rejeitar"]),
  comentario: z.string().max(1000).optional().nullable(),
  valor_editado: z.number().positive().optional().nullable(),
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  }

  const { data, error } = await supabase
    .from("pricing_ajustes_propostos")
    .select("*")
    .eq("id", Number(params.id))
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Não encontrada" }, { status: 404 })
  }

  return NextResponse.json({ data })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canApprove(email)) {
    return NextResponse.json({ error: "Sem permissão para decidir propostas" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = decisionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  }

  const id = Number(params.id)
  const { data: current, error: fetchErr } = await supabase
    .from("pricing_ajustes_propostos")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 })
  }

  if (current.status !== "pendente") {
    return NextResponse.json(
      { error: `Proposta já foi ${current.status}` },
      { status: 409 },
    )
  }

  const novoStatus = parsed.data.acao === "aprovar" ? "aprovado" : "rejeitado"
  const valorFinal =
    parsed.data.acao === "aprovar"
      ? parsed.data.valor_editado ?? Number(current.baserate_sugerido)
      : null

  const { data: updated, error: updErr } = await supabase
    .from("pricing_ajustes_propostos")
    .update({
      status: novoStatus,
      aprovado_por: email,
      aprovado_em: new Date().toISOString(),
      comentario_revisor: parsed.data.comentario ?? null,
      baserate_aplicado: novoStatus === "aprovado" ? valorFinal : null,
    })
    .eq("id", id)
    .select()
    .single()

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  if (novoStatus === "aprovado") {
    const webhookUrl = process.env.N8N_APLICAR_BASERATE_WEBHOOK_URL
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: updated.id,
            idpropriedade: updated.idpropriedade,
            period_id: updated.period_id,
            baserate_aprovado: valorFinal,
            aprovado_por: email,
            comentario_revisor: parsed.data.comentario ?? null,
          }),
        })
      } catch (err) {
        console.error("[pricing-ajustes] webhook trigger failed:", err)
        await supabase
          .from("pricing_ajustes_propostos")
          .update({ apply_error: err instanceof Error ? err.message : String(err) })
          .eq("id", id)
      }
    }
  }

  return NextResponse.json({ data: updated })
}
