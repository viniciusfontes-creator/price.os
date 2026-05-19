/**
 * GO LIVE: vincula a Pysa à region "Rota Milagres" e aplica os 20 baseRates
 * sugeridos pela IA. Chama a Stays de VERDADE.
 *
 * Roda:
 *   npx tsx --env-file=.env.local scripts/go-live-pysa.ts
 */

import { getSupabaseAdmin } from "../lib/supabase-server"
import {
    linkListingToRegion,
    applySeasonPrices,
    listListingSeasons,
} from "../lib/stays/pricing"

const PYSA_ONBOARDING_ID = "8e55677a-d169-4379-822f-6097eae7c6b4"
const PYSA_LISTING_ID = "69d976283a4375e9d12ca67a"

interface SeasonDecision {
    _idseason: string
    suggested_base_rate?: number | null
    approved_base_rate?: number | null
    needs_monthly_rate?: boolean
    from?: string
    to?: string
}

async function main() {
    const sb = getSupabaseAdmin()!
    console.log("[1] Lendo pricing_config + region da Supabase...")
    const { data: row, error } = await sb
        .from("property_onboarding")
        .select("pricing_config, stays_region_id, stays_region_name")
        .eq("id", PYSA_ONBOARDING_ID)
        .single()
    if (error || !row) {
        console.error("erro:", error)
        process.exit(1)
    }
    const r = row as Record<string, unknown>
    const pc = r.pricing_config as { mode?: string; seasons?: SeasonDecision[] } | null
    const regionId = r.stays_region_id as string | null
    const regionName = r.stays_region_name as string | null
    if (!pc?.seasons?.length || !regionId) {
        console.error("Sem pricing_config ou region — abortando")
        process.exit(1)
    }
    console.log(`  → region target: ${regionName} (${regionId})`)
    console.log(`  → seasons: ${pc.seasons.length}`)

    console.log("\n[2] GO LIVE — linkListingToRegion...")
    let linkResult: unknown
    try {
        linkResult = await linkListingToRegion({
            listingId: PYSA_LISTING_ID,
            regionId,
            dryRun: false,
        })
        console.log("  ✅ link OK:", JSON.stringify(linkResult).slice(0, 300))
    } catch (e) {
        console.error("  ❌ link falhou:", e)
        const msg = e instanceof Error ? e.message : String(e)
        const body = (e as { body?: unknown }).body
        console.error("  body:", body)
        process.exit(1)
    }

    console.log("\n[3] Verificando seasons atuais da Pysa via REST...")
    const today = new Date().toISOString().slice(0, 10)
    const oneYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
    const beforeApply = await listListingSeasons({
        listingId: PYSA_LISTING_ID,
        from: today,
        to: oneYear,
    })
    console.log(`  Stays retornou: ${beforeApply.length} seasons`)
    console.log(`  baseRate atuais (5 primeiras):`)
    for (const s of beforeApply.slice(0, 5)) {
        console.log(`    ${s.from}..${s.to} → R$ ${s.baseRateValue}`)
    }

    console.log("\n[4] GO LIVE — applySeasonPrices (20 PATCHes)...")
    const updates = pc.seasons
        .map((s) => {
            const v = s.approved_base_rate ?? s.suggested_base_rate ?? null
            if (v == null || !Number.isFinite(Number(v)) || Number(v) <= 0) return null
            return { seasonId: s._idseason, baseRate: Number(v) }
        })
        .filter((u): u is { seasonId: string; baseRate: number } => u != null)

    console.log(`  → ${updates.length} updates a aplicar`)
    const applyResult = await applySeasonPrices({
        listingId: PYSA_LISTING_ID,
        updates,
        dryRun: false,
    })
    console.log(`  ✅ successes: ${applyResult.successes.length}`)
    console.log(`  ❌ failures: ${applyResult.failures.length}`)
    if (applyResult.failures.length) {
        console.log(`  Detalhes failures:`)
        for (const f of applyResult.failures.slice(0, 5)) {
            console.log(`    ${f.seasonId}: status=${f.status} needsMonthly=${f.needsMonthlyRate} msg=${f.message.slice(0, 120)}`)
        }
    }

    console.log("\n[5] Atualizando stays_sync_status na Supabase...")
    const finalStatus =
        applyResult.failures.length === 0
            ? "synced"
            : applyResult.successes.length > 0
              ? "partial"
              : "error"
    await sb
        .from("property_onboarding")
        .update({
            stays_sync_status: finalStatus,
            stays_synced_at: new Date().toISOString(),
            stays_sync_errors:
                applyResult.failures.length > 0
                    ? { items: applyResult.failures }
                    : null,
        })
        .eq("id", PYSA_ONBOARDING_ID)
    console.log(`  → status: ${finalStatus}`)

    console.log("\n[6] Re-checando seasons após PATCHes (5 primeiras):")
    const afterApply = await listListingSeasons({
        listingId: PYSA_LISTING_ID,
        from: today,
        to: oneYear,
    })
    for (const s of afterApply.slice(0, 5)) {
        console.log(`    ${s.from}..${s.to} → R$ ${s.baseRateValue}`)
    }

    console.log("\n🎉 DONE.")
}

main().catch((e) => {
    console.error("erro fatal:", e)
    process.exit(1)
})
