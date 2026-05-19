/**
 * Helpers de sincronização Price.OS → Stays para fluxos fora do onboarding.
 *
 * Hoje só temos um caller: o endpoint PATCH /api/pricing/ajustes/[id] que
 * aprova uma proposta em pricing_ajustes_propostos. Depois da aprovação,
 * `applyPricingAjusteToStays()` resolve os mappings e chama applySeasonPrices.
 *
 * Mappings (caches em Supabase, ver migration 013):
 *   idpropriedade  → stays_listing_id   (stays_property_map)
 *   (listing,period_id) → stays_season_id (stays_season_map)
 *
 * Fonte primária de stays_listing_id: warehouse.propriedades_subgrupos no BQ
 * (mesma query do step 01b do onboarding).
 *
 * Fonte primária de stays_season_id: listListingSeasons(listingId, from, to)
 * pegando a season cujo range cobre o pricing_period.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { executeQuery } from "@/lib/bigquery-client"
import { applySeasonPrices, listListingSeasons } from "./pricing"

// ============================================================================
// Tipos
// ============================================================================

export type StaysSyncStatus = "synced" | "dry_run" | "unmapped" | "error"

export interface ApplyPricingAjusteResult {
    status: StaysSyncStatus
    syncedAt: string
    errors: unknown | null
    resolved: { listingId: string; seasonId: string } | null
}

interface AjusteInput {
    id: number
    idpropriedade: string
    period_id: string
    baserate_aplicado: number
}

// ============================================================================
// Resolução de stays_listing_id
// ============================================================================

const SQL_RESOLVE_LISTING = `
SELECT CAST(Pricemaster_ID AS STRING) AS pricemaster_id
FROM \`warehouse.propriedades_subgrupos\`
WHERE CAST(idPropriedade AS STRING) = @idpropriedade
LIMIT 1
`

async function resolveListingId(
    idpropriedade: string,
    supabase: SupabaseClient,
): Promise<string | null> {
    // 1. cache local
    const { data: cached } = await supabase
        .from("stays_property_map")
        .select("stays_listing_id")
        .eq("idpropriedade", idpropriedade)
        .maybeSingle()
    if (cached?.stays_listing_id) return cached.stays_listing_id

    // 2. warehouse BQ (fonte primária)
    try {
        const rows = await executeQuery<{ pricemaster_id: string | null }>(
            SQL_RESOLVE_LISTING,
            { idpropriedade },
        )
        const listingId = rows[0]?.pricemaster_id ?? null
        if (!listingId) return null

        // cacheia
        await supabase
            .from("stays_property_map")
            .upsert(
                {
                    idpropriedade,
                    stays_listing_id: listingId,
                    source: "warehouse",
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "idpropriedade" },
            )
        return listingId
    } catch (e) {
        console.error("[stays-sync] resolveListingId BQ falhou", e)
        return null
    }
}

// ============================================================================
// Resolução de stays_season_id
// ============================================================================

interface SeasonResolution {
    seasonId: string | null
    reason?: "no_period" | "no_season_in_range" | "ambiguous" | "api_error"
    detail?: string
}

async function resolveSeasonId(
    listingId: string,
    periodId: string,
    supabase: SupabaseClient,
): Promise<SeasonResolution> {
    // 1. cache local
    const { data: cached } = await supabase
        .from("stays_season_map")
        .select("stays_season_id")
        .eq("stays_listing_id", listingId)
        .eq("period_id", periodId)
        .maybeSingle()
    if (cached?.stays_season_id) return { seasonId: cached.stays_season_id }

    // 2. Lê datas do pricing_period
    const { data: period } = await supabase
        .from("pricing_periods")
        .select("start_date,end_date,name")
        .eq("id", periodId)
        .maybeSingle()
    if (!period?.start_date || !period?.end_date) {
        return { seasonId: null, reason: "no_period", detail: `period ${periodId} não encontrado` }
    }

    // 3. Busca seasons da listing no range do period e seleciona a que cobre
    try {
        const seasons = await listListingSeasons({
            listingId,
            from: period.start_date as string,
            to: period.end_date as string,
        })
        // Filtra seasons ativas que cobrem o range do period
        const covering = seasons.filter(
            (s) =>
                s.status === "active" &&
                s.from <= (period.start_date as string) &&
                s.to >= (period.end_date as string),
        )
        if (covering.length === 0) {
            return {
                seasonId: null,
                reason: "no_season_in_range",
                detail: `nenhuma season ativa cobre ${period.start_date}..${period.end_date} (${period.name})`,
            }
        }
        // Quando múltiplas seasons cobrem o range (típico em eventos dentro
        // de um mês: a Stays tem 1 season "container" do mês + 1 season-evento
        // mais específica para os dias do evento), escolhemos a MAIS ESPECÍFICA
        // (menor span em dias). É como a Stays aplica internamente: a season-filha
        // sobrescreve a container nos seus dias.
        const daySpan = (s: { from: string; to: string }) =>
            (new Date(s.to).getTime() - new Date(s.from).getTime()) / 86400000
        const sorted = [...covering].sort((a, b) => daySpan(a) - daySpan(b))
        const minSpan = daySpan(sorted[0])
        const tied = sorted.filter((s) => daySpan(s) === minSpan)
        if (tied.length > 1) {
            return {
                seasonId: null,
                reason: "ambiguous",
                detail: `${tied.length} seasons com mesmo span cobrem o range (${tied.map((s) => s._idseason).join(", ")})`,
            }
        }
        const chosen = sorted[0]
        // cacheia
        await supabase
            .from("stays_season_map")
            .upsert(
                {
                    stays_listing_id: listingId,
                    period_id: periodId,
                    stays_season_id: chosen._idseason,
                    season_from: chosen.from,
                    season_to: chosen.to,
                    source: "auto",
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "stays_listing_id,period_id" },
            )
        return { seasonId: chosen._idseason }
    } catch (e) {
        return {
            seasonId: null,
            reason: "api_error",
            detail: e instanceof Error ? e.message : String(e),
        }
    }
}

// ============================================================================
// Orquestrador principal
// ============================================================================

export async function applyPricingAjusteToStays(
    ajuste: AjusteInput,
    opts: { dryRun: boolean; supabase: SupabaseClient },
): Promise<ApplyPricingAjusteResult> {
    const syncedAt = new Date().toISOString()

    // 1. Resolve listing
    const listingId = await resolveListingId(ajuste.idpropriedade, opts.supabase)
    if (!listingId) {
        return {
            status: "unmapped",
            syncedAt,
            errors: {
                reason: "unmapped_listing",
                detail: `idpropriedade ${ajuste.idpropriedade} não encontrada em warehouse.propriedades_subgrupos (Pricemaster_ID)`,
            },
            resolved: null,
        }
    }

    // 2. Resolve season
    const seasonRes = await resolveSeasonId(listingId, ajuste.period_id, opts.supabase)
    if (!seasonRes.seasonId) {
        return {
            status: "unmapped",
            syncedAt,
            errors: {
                reason: `unmapped_season:${seasonRes.reason ?? "unknown"}`,
                detail: seasonRes.detail,
                listingId,
            },
            resolved: null,
        }
    }

    // 3. PATCH (ou simula)
    const result = await applySeasonPrices({
        listingId,
        updates: [
            {
                seasonId: seasonRes.seasonId,
                baseRate: ajuste.baserate_aplicado,
            },
        ],
        dryRun: opts.dryRun,
    })

    if (result.failures.length > 0) {
        return {
            status: "error",
            syncedAt,
            errors: { items: result.failures },
            resolved: { listingId, seasonId: seasonRes.seasonId },
        }
    }

    return {
        status: opts.dryRun ? "dry_run" : "synced",
        syncedAt,
        errors: null,
        resolved: { listingId, seasonId: seasonRes.seasonId },
    }
}
