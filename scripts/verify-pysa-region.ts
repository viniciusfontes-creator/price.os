/**
 * Verifica via REST que a Pysa está vinculada à region Rota Milagres
 * (depois do linkListingToRegion).
 *
 *   npx tsx --env-file=.env.local scripts/verify-pysa-region.ts
 */

import { staysFetch } from "../lib/stays/client"

const PYSA_LISTING_ID = "69d976283a4375e9d12ca67a"

async function main() {
    console.log("[1] GET /external/v1/content/listings/{_id}...")
    const data = await staysFetch<Record<string, unknown>>(
        `/external/v1/content/listings/${PYSA_LISTING_ID}`,
    )
    console.log("  _id:", data._id)
    console.log("  id (partnerCode):", data.id)
    console.log("  _idproperty:", data._idproperty)
    console.log("  _idregion:", data._idregion)
    console.log("  _idPriceRegion:", data._idPriceRegion)
    console.log("  priceRegion:", data.priceRegion)
    // Imprime apenas campos relacionados a region
    const keys = Object.keys(data).filter((k) => k.toLowerCase().includes("region"))
    for (const k of keys) console.log(`  ${k}:`, data[k])
}

main().catch((e) => {
    console.error("erro:", e)
    process.exit(1)
})
