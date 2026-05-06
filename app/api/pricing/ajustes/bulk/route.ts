import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { canApprove } from "@/lib/metas-ajustes/rbac"

const bulkSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  acao: z.enum(["aprovar", "rejeitar"]),
  comentario: z.string().max(1000).optional().nullable(),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canApprove(email)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  }

  const novoStatus = parsed.data.acao === "aprovar" ? "aprovado" : "rejeitado"

  const { data: pendentes, error: fetchErr } = await supabase
    .from("pricing_ajustes_propostos")
    .select("id, idpropriedade, period_id, baserate_sugerido, status")
    .in("id", parsed.data.ids)
    .eq("status", "pendente")

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!pendentes || pendentes.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, skipped: parsed.data.ids.length })
  }

  const ids = pendentes.map((p) => p.id)
  const nowIso = new Date().toISOString()

  const updates = pendentes.map((p) => ({
    id: p.id,
    status: novoStatus,
    aprovado_por: email,
    aprovado_em: nowIso,
    comentario_revisor: parsed.data.comentario ?? null,
    baserate_aplicado: novoStatus === "aprovado" ? Number(p.baserate_sugerido) : null,
  }))

  const { error: updErr } = await supabase.from("pricing_ajustes_propostos").upsert(updates)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  if (novoStatus === "aprovado") {
    const webhookUrl = process.env.N8N_APLICAR_BASERATE_WEBHOOK_URL
    if (webhookUrl) {
      await Promise.allSettled(
        pendentes.map((p) =>
          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: p.id,
              idpropriedade: p.idpropriedade,
              period_id: p.period_id,
              baserate_aprovado: Number(p.baserate_sugerido),
              aprovado_por: email,
              comentario_revisor: parsed.data.comentario ?? null,
            }),
          }),
        ),
      )
    }
  }

  return NextResponse.json({
    ok: true,
    processed: ids.length,
    skipped: parsed.data.ids.length - ids.length,
  })
}
