/**
 * Step 01c: Snapshot das seasons ativas da listing na Stays (365 dias).
 *
 * GET /external/v1/parr/listing-rates-sell?listingId&from&to.
 * Salva resultado em property_onboarding.stays_snapshot_seasons (read-only).
 *
 * Em caso de listing-id ausente ou erro de rede, retorna [] e o step
 * downstream (suggest-baserate v2) cai no fallback (sugestão sem snapshot).
 */

import { snapshotSeasonsForYear, type ListingSeason } from "@/lib/stays/pricing"
import { StaysApiError } from "@/lib/stays/client"

export interface SnapshotResult {
    seasons: ListingSeason[]
    error?: string
}

export async function staysSnapshotSeasons(listingId: string | null): Promise<SnapshotResult> {
    if (!listingId) {
        return { seasons: [], error: "stays_listing_id ausente" }
    }
    try {
        const seasons = await snapshotSeasonsForYear(listingId)
        return { seasons }
    } catch (e) {
        const msg = e instanceof StaysApiError
            ? `Stays ${e.status}: ${JSON.stringify(e.body).slice(0, 200)}`
            : (e as Error).message
        return { seasons: [], error: msg }
    }
}
