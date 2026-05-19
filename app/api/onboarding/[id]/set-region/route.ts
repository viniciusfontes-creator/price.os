/**
 * POST /api/onboarding/:id/set-region
 *
 * Vincula a listing a uma price-region escolhida pelo operador. Após vincular,
 * recarrega as seasons da Stays (que agora refletem a nova region), recalcula
 * sugestões de baseRate via step 15, faz PATCH em todas, e atualiza o
 * pricing_config + region no Supabase.
 *
 * Body: { regionId: string, regionName?: string }
 *
 * Em dry-run: simula link + simula PATCHes. Em LIVE: muda Stays.
 */

import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getOnboarding, logEvent, updateOnboarding } from "@/lib/onboarding/repository"
import {
    applySeasonPrices,
    linkListingToRegion,
    listListingSeasons,
} from "@/lib/stays/pricing"
import { suggestSeasonBaserates } from "@/lib/onboarding/steps/15-suggest-baserate"
import { isDryRun } from "@/lib/onboarding/constants"
import type {
    BqHydratedProperty,
    JestorPayload,
    MetaDistribuicaoMensal,
    PipelineContext,
} from "@/lib/onboarding/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    const operatorEmail = session?.user?.email
    if (!operatorEmail) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as {
        regionId?: string
        regionName?: string
    }
    const regionId = body.regionId?.trim()
    if (!regionId) {
        return NextResponse.json({ error: "regionId obrigatório" }, { status: 400 })
    }

    const row = await getOnboarding(params.id)
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    const r = row as unknown as Record<string, unknown>
    const stays_listing_id = r.stays_listing_id as string | null
    if (!stays_listing_id) {
        return NextResponse.json(
            { error: "stays_listing_id ausente — refaça o enrichment primeiro" },
            { status: 422 },
        )
    }

    const dryRun = isDryRun()
    await updateOnboarding(params.id, {
        stays_sync_status: "syncing",
    } as Record<string, unknown>)
    await logEvent(params.id, row.idpropriedade, "stays_region_change_started", {
        operator: operatorEmail,
        new_region_id: regionId,
        new_region_name: body.regionName ?? null,
        dry_run: dryRun,
    })

    // Etapa 1: vincular região via JSON-RPC
    try {
        await linkListingToRegion({
            listingId: stays_listing_id,
            regionId,
            dryRun,
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await logEvent(params.id, row.idpropriedade, "stays_region_link_failed", {
            error: msg,
            dry_run: dryRun,
        })
        await updateOnboarding(params.id, {
            stays_sync_status: "error",
            stays_sync_errors: { region_link: msg } as Record<string, unknown>,
        } as Record<string, unknown>)
        return NextResponse.json(
            { error: `Falha ao vincular região: ${msg}` },
            { status: 502 },
        )
    }

    // Etapa 2: ler novas seasons. Em dry-run, NÃO chamou Stays — então
    // pula re-snapshot e mantém o pricing_config antigo (sem alterá-lo).
    if (dryRun) {
        await updateOnboarding(params.id, {
            stays_region_id: regionId,
            stays_region_name: body.regionName ?? null,
            stays_sync_status: "dry_run",
            stays_synced_at: new Date().toISOString(),
        } as Record<string, unknown>)
        await logEvent(params.id, row.idpropriedade, "stays_region_changed", {
            new_region_id: regionId,
            new_region_name: body.regionName ?? null,
            dry_run: true,
        })
        return NextResponse.json({
            success: true,
            dry_run: true,
            message: "Dry-run: região marcada, sem alterações na Stays",
        })
    }

    // Etapa 3: re-snapshot + sugestões + re-PATCH (LIVE)
    const today = new Date().toISOString().slice(0, 10)
    const oneYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
    const snapshot = await listListingSeasons({
        listingId: stays_listing_id,
        from: today,
        to: oneYear,
    })

    if (snapshot.length === 0) {
        await updateOnboarding(params.id, {
            stays_region_id: regionId,
            stays_region_name: body.regionName ?? null,
            stays_sync_status: "synced",
            stays_synced_at: new Date().toISOString(),
            pricing_config: null,
        } as Record<string, unknown>)
        return NextResponse.json({
            success: true,
            dry_run: false,
            message: "Região vinculada, mas a nova region não tem templates",
            seasons_count: 0,
        })
    }

    // Monta ctx mínimo pra suggestSeasonBaserates
    const ctx: PipelineContext = {
        onboardingId: params.id,
        idpropriedade: row.idpropriedade,
        payload: row.jestor_payload as unknown as JestorPayload,
        bq: (r.bq_snapshot as BqHydratedProperty | null) ?? null,
        metaDistribuicao:
            (r.meta_distribuicao_mensal as { items?: MetaDistribuicaoMensal[] } | null)
                ?.items ?? [],
    }
    const suggestions = await suggestSeasonBaserates(ctx, snapshot)

    // Re-PATCH automático com sugestões
    const updates = suggestions
        .filter((s) => s.suggestedBaseRate != null && s.suggestedBaseRate > 0)
        .map((s) => ({
            seasonId: s._idseason,
            baseRate: s.suggestedBaseRate as number,
        }))

    const applyResult = await applySeasonPrices({
        listingId: stays_listing_id,
        updates,
        dryRun: false,
    })

    const finalStatus =
        applyResult.failures.length === 0
            ? "synced"
            : applyResult.successes.length > 0
              ? "partial"
              : "error"

    // Atualiza pricing_config + region
    await updateOnboarding(params.id, {
        stays_region_id: regionId,
        stays_region_name: body.regionName ?? null,
        stays_sync_status: finalStatus,
        stays_synced_at: new Date().toISOString(),
        stays_snapshot_seasons: {
            items: snapshot,
        } as Record<string, unknown>,
        pricing_config: {
            mode: "manual",
            seasons: suggestions.map((s) => ({
                _idseason: s._idseason,
                from: s.seasonFrom,
                to: s.seasonTo,
                current_base_rate: s.currentBaseRate,
                suggested_base_rate: s.suggestedBaseRate,
                approved_base_rate: s.suggestedBaseRate,
                reason: s.reason,
                needs_monthly_rate: s.needsMonthlyRate,
            })),
        } as Record<string, unknown>,
        stays_sync_errors:
            applyResult.failures.length > 0
                ? ({ items: applyResult.failures } as Record<string, unknown>)
                : null,
    } as Record<string, unknown>)

    await logEvent(params.id, row.idpropriedade, "stays_region_changed", {
        new_region_id: regionId,
        new_region_name: body.regionName ?? null,
        dry_run: false,
        seasons_count: snapshot.length,
        successes: applyResult.successes.length,
        failures: applyResult.failures.length,
    })

    return NextResponse.json({
        success: true,
        dry_run: false,
        status: finalStatus,
        seasons_count: snapshot.length,
        successes: applyResult.successes.length,
        failures: applyResult.failures.length,
        failure_details: applyResult.failures,
    })
}
