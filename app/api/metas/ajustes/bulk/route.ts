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

type BulkFailure = { id: number; error: string }

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
  const nowIso = new Date().toISOString()
  const comentario = parsed.data.comentario ?? null

  const { data: pendentes, error: fetchErr } = await supabase
    .from("metas_ajustes_propostos")
    .select("id, idpropriedade, mes_ano, meta_sugerida, status")
    .in("id", parsed.data.ids)
    .eq("status", "pendente")

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const skipped = parsed.data.ids.length - (pendentes?.length ?? 0)
  if (!pendentes || pendentes.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      skipped,
      failed: 0,
      processedIds: [],
      failedIds: [],
      failures: [] as BulkFailure[],
    })
  }

  // Per-row updates in parallel (see pricing/bulk for rationale: upsert
  // can fail because of NOT NULL columns missing from the patch payload).
  const updateResults = await Promise.allSettled(
    pendentes.map((p) =>
      supabase
        .from("metas_ajustes_propostos")
        .update({
          status: novoStatus,
          aprovado_por: email,
          aprovado_em: nowIso,
          comentario_revisor: comentario,
          meta_aplicada:
            novoStatus === "aprovado" ? Number(p.meta_sugerida) : null,
        })
        .eq("id", p.id)
        .eq("status", "pendente")
        .select("id")
        .single()
        .then((r) => ({ id: p.id, error: r.error, rowMissing: !r.data })),
    ),
  )

  const processedIds: number[] = []
  const failures: BulkFailure[] = []
  for (let i = 0; i < updateResults.length; i++) {
    const res = updateResults[i]
    const p = pendentes[i]
    if (res.status === "fulfilled") {
      if (res.value.error) {
        failures.push({ id: p.id, error: res.value.error.message })
      } else if (res.value.rowMissing) {
        // Race — already decided. Counts as skipped.
      } else {
        processedIds.push(p.id)
      }
    } else {
      failures.push({
        id: p.id,
        error:
          res.reason instanceof Error ? res.reason.message : String(res.reason),
      })
    }
  }

  if (novoStatus === "aprovado" && processedIds.length > 0) {
    const webhookUrl = process.env.N8N_APLICAR_META_WEBHOOK_URL
    if (webhookUrl) {
      const approvedRows = pendentes.filter((p) => processedIds.includes(p.id))
      const webhookResults = await Promise.allSettled(
        approvedRows.map(async (p) => {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: p.id,
              idpropriedade: p.idpropriedade,
              mes_ano: p.mes_ano,
              meta_aprovada: Number(p.meta_sugerida),
              aprovado_por: email,
              comentario_revisor: comentario,
            }),
          })
          if (!res.ok) {
            throw new Error(`webhook HTTP ${res.status}`)
          }
          return p.id
        }),
      )

      const webhookErrors: { id: number; error: string }[] = []
      for (let i = 0; i < webhookResults.length; i++) {
        const r = webhookResults[i]
        if (r.status === "rejected") {
          webhookErrors.push({
            id: approvedRows[i].id,
            error:
              r.reason instanceof Error ? r.reason.message : String(r.reason),
          })
        }
      }

      if (webhookErrors.length > 0) {
        await Promise.allSettled(
          webhookErrors.map((e) =>
            supabase
              .from("metas_ajustes_propostos")
              .update({ apply_error: e.error })
              .eq("id", e.id),
          ),
        )
        console.error("[metas-ajustes/bulk] webhook failures:", webhookErrors)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    processed: processedIds.length,
    skipped,
    failed: failures.length,
    processedIds,
    failedIds: failures.map((f) => f.id),
    failures,
  })
}
