/**
 * Diagnostica por que pricing_config.seasons está vazio para a Pysa.
 *
 * Hipóteses:
 *  H1) Stays API retorna 0 seasons no listing-rates-sell (region "Padrão" sem
 *      templates) → reprocessar com region linkada resolve
 *  H2) BQ/Step 14 falhou silenciosamente
 *  H3) pricing_config foi serializado mas seasons sumiu
 *
 * Roda:
 *   node --env-file=.env.local node_modules/.bin/jiti scripts/diagnose-pysa-seasons.ts
 */

import { getSupabaseAdmin } from "../lib/supabase-server"
import { listListingSeasons } from "../lib/stays/pricing"

const PYSA_ONBOARDING_ID = "8e55677a-d169-4379-822f-6097eae7c6b4"
const PYSA_LISTING_ID = "69d976283a4375e9d12ca67a"

async function main() {
    const sb = getSupabaseAdmin()!

    console.log("[1] Estado atual do onboarding na Supabase:")
    const { data: row, error } = await sb
        .from("property_onboarding")
        .select("*")
        .eq("id", PYSA_ONBOARDING_ID)
        .single()
    if (error) {
        console.error("erro:", error)
        process.exit(1)
    }
    const r = row as Record<string, unknown>
    console.log("  state:", r.state)
    console.log("  stays_listing_id:", r.stays_listing_id)
    console.log("  stays_region_id:", r.stays_region_id)
    console.log("  stays_region_name:", r.stays_region_name)
    console.log("  stays_sync_status:", r.stays_sync_status)
    const pc = r.pricing_config as { seasons?: unknown[]; mode?: string } | null
    console.log("  pricing_config:", pc ? `mode=${pc.mode}, seasons=${pc.seasons?.length ?? 0}` : "null")

    const snapshot = r.stays_snapshot_seasons as { items?: unknown[] } | null
    console.log("  stays_snapshot_seasons.items:", snapshot?.items?.length ?? 0)

    console.log("\n[2] Quantas seasons a Stays REST retorna agora para Pysa?")
    const today = new Date().toISOString().slice(0, 10)
    const oneYearLater = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
    try {
        const seasons = await listListingSeasons({
            listingId: PYSA_LISTING_ID,
            from: today,
            to: oneYearLater,
        })
        console.log(`  → ${seasons.length} seasons retornadas pela Stays`)
        if (seasons.length) {
            console.log("  primeira:", JSON.stringify(seasons[0]).slice(0, 250))
        }
    } catch (e) {
        console.log("  → erro:", (e as Error).message)
    }
}

main().catch((e) => {
    console.error("erro fatal:", e)
    process.exit(1)
})
