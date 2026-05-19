/**
 * Acha o onboarding ID da Pysa via Supabase admin.
 *
 * Roda:
 *   node --env-file=.env.local node_modules/.bin/jiti scripts/find-pysa-onboarding.ts
 */

import { getSupabaseAdmin } from "../lib/supabase-server"

async function main() {
    const sb = getSupabaseAdmin()
    if (!sb) throw new Error("Supabase admin client unavailable")

    const { data, error } = await sb
        .from("property_onboarding")
        .select(
            "id, idpropriedade, state, stays_listing_id, stays_region_id, stays_region_name, pricing_config, jestor_payload",
        )
        .or("idpropriedade.ilike.%Pysa%,jestor_payload->>rotulo.ilike.%Pysa%,jestor_payload->>propriedade.ilike.%Pysa%")
        .order("created_at", { ascending: false })
        .limit(5)

    if (error) {
        console.error("erro:", error)
        process.exit(1)
    }

    console.log(`encontrados: ${data?.length ?? 0}`)
    for (const row of data ?? []) {
        const r = row as Record<string, unknown>
        const seasons = (r.pricing_config as { seasons?: unknown[] })?.seasons?.length ?? 0
        console.log({
            id: r.id,
            idpropriedade: r.idpropriedade,
            state: r.state,
            stays_listing_id: r.stays_listing_id,
            stays_region_id: r.stays_region_id,
            stays_region_name: r.stays_region_name,
            seasons_count: seasons,
        })
    }
}

main().catch((e) => {
    console.error("erro fatal:", e)
    process.exit(1)
})
