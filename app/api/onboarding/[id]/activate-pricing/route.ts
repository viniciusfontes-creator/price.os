/**
 * POST /api/onboarding/:id/activate-pricing
 *
 * Dispara o "Ativar Unidade" atômico:
 *   1. Valida que pricing_config existe e tem decisões aprovadas
 *   2. Em DRY-RUN: simula PATCHes (apenas grava status='dry_run' + log)
 *   3. Em modo real: PATCH em loop em todas seasons aprovadas
 *   4. Tratamento de erro 400 "Monthly rate required" → registra como pendência
 *   5. Atualiza stays_sync_status / stays_synced_at / stays_sync_errors
 *
 * Idempotente: pode ser chamado várias vezes (retry de falhas).
 *
 * NÃO transiciona o estado do onboarding aqui — isso continua sendo
 * decisão do operador via conclude.ts. Este endpoint só sincroniza com a Stays.
 */

import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getOnboarding, logEvent, updateOnboarding } from "@/lib/onboarding/repository"
import { applySeasonPrices } from "@/lib/stays/pricing"
import { isDryRun } from "@/lib/onboarding/constants"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

interface SeasonDecision {
    _idseason: string
    approved_base_rate?: number | null
    approved_monthly_rate?: number | null
    suggested_base_rate?: number | null
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    const operatorEmail = session?.user?.email
    if (!operatorEmail) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const row = await getOnboarding(params.id)
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    const r = row as unknown as Record<string, unknown>
    const stays_listing_id = r.stays_listing_id as string | null
    const pricing_config = r.pricing_config as
        | { mode?: string; seasons?: SeasonDecision[] }
        | null

    if (!stays_listing_id) {
        return NextResponse.json(
            { error: "stays_listing_id ausente — refaça o enrichment" },
            { status: 422 },
        )
    }
    if (!pricing_config?.seasons?.length) {
        return NextResponse.json(
            { error: "pricing_config sem seasons — refaça o enrichment ou configure na UI" },
            { status: 422 },
        )
    }

    // Determina o valor final por season: approved (operador) tem prioridade,
    // senão usa suggested (IA). Se ambos nulos, pula.
    const updates: Array<{ seasonId: string; baseRate: number; monthlyRate?: number }> = []
    let skipped = 0
    for (const s of pricing_config.seasons) {
        const finalBase = s.approved_base_rate ?? s.suggested_base_rate ?? null
        if (finalBase == null || !Number.isFinite(finalBase) || finalBase <= 0) {
            skipped += 1
            continue
        }
        updates.push({
            seasonId: s._idseason,
            baseRate: Number(finalBase),
            monthlyRate: s.approved_monthly_rate ?? undefined,
        })
    }

    if (updates.length === 0) {
        return NextResponse.json(
            { error: "Nenhuma season com valor aprovado ou sugerido" },
            { status: 422 },
        )
    }

    const dryRun = isDryRun()

    await updateOnboarding(params.id, {
        stays_sync_status: "syncing",
    } as Record<string, unknown>)
    await logEvent(params.id, row.idpropriedade, "stays_apply_started", {
        operator: operatorEmail,
        updates_count: updates.length,
        skipped_count: skipped,
        dry_run: dryRun,
    })

    const result = await applySeasonPrices({
        listingId: stays_listing_id,
        updates,
        dryRun,
    })

    const finalStatus =
        result.failures.length === 0
            ? dryRun
                ? "dry_run"
                : "synced"
            : result.successes.length > 0
              ? "partial"
              : "error"

    await updateOnboarding(params.id, {
        stays_sync_status: finalStatus,
        stays_synced_at: new Date().toISOString(),
        stays_sync_errors:
            result.failures.length > 0
                ? ({ items: result.failures } as Record<string, unknown>)
                : null,
    } as Record<string, unknown>)

    await logEvent(params.id, row.idpropriedade, "stays_apply_done", {
        operator: operatorEmail,
        successes: result.successes.length,
        failures: result.failures.length,
        dry_run: dryRun,
        final_status: finalStatus,
    })

    return NextResponse.json({
        success: true,
        dry_run: dryRun,
        status: finalStatus,
        successes: result.successes.length,
        failures: result.failures.length,
        failure_details: result.failures,
        skipped,
    })
}
