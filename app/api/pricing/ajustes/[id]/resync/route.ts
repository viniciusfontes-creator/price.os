/**
 * POST /api/pricing/ajustes/[id]/resync
 *
 * Re-executa a sincronização com a Stays para uma proposta já aprovada.
 * Idempotente: usa o `baserate_aplicado` atual da linha.
 *
 * Usado pelo botão "Tentar de novo" quando `stays_sync_status` é
 * 'error' ou 'unmapped'. Não toca em status/aprovado_por/aprovado_em.
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { canApprove } from "@/lib/metas-ajustes/rbac"
import { applyPricingAjusteToStays } from "@/lib/stays/sync-helpers"
import { isPricingApplyDryRun } from "@/lib/stays/dry-run"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canApprove(email)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  }

  const id = Number(params.id)
  const { data: current, error: fetchErr } = await supabase
    .from("pricing_ajustes_propostos")
    .select("id, idpropriedade, period_id, baserate_aplicado, status")
    .eq("id", id)
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 })
  }
  if (current.status !== "aprovado") {
    return NextResponse.json(
      { error: `Resync só roda em propostas aprovadas (atual: ${current.status})` },
      { status: 409 },
    )
  }
  if (current.baserate_aplicado == null) {
    return NextResponse.json(
      { error: "Proposta aprovada sem baserate_aplicado — estado inconsistente" },
      { status: 422 },
    )
  }

  const staysSync = await applyPricingAjusteToStays(
    {
      id: current.id,
      idpropriedade: current.idpropriedade,
      period_id: current.period_id,
      baserate_aplicado: Number(current.baserate_aplicado),
    },
    { dryRun: isPricingApplyDryRun(), supabase },
  )

  await supabase
    .from("pricing_ajustes_propostos")
    .update({
      stays_sync_status: staysSync.status,
      stays_synced_at: staysSync.syncedAt,
      stays_sync_errors: staysSync.errors as Record<string, unknown> | null,
    })
    .eq("id", id)

  return NextResponse.json({ stays_sync: staysSync })
}
