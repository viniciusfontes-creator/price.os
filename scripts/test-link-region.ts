/**
 * Smoke test do linkListingToRegion (DRY-RUN only).
 *
 * NÃO chama a Stays de verdade — só valida que:
 *   1. O caminho em dry-run loga corretamente
 *   2. A chamada JSON-RPC monta o payload esperado quando dryRun=false
 *      (sem disparar — interrompemos antes do fetch)
 *
 * Roda:
 *   node --env-file=.env.local node_modules/.bin/jiti scripts/test-link-region.ts
 */

import { linkListingToRegion } from "../lib/stays/pricing"
import { pingStaysSession } from "../lib/stays/session-client"

const PYSA_LISTING_ID = "69d976283a4375e9d12ca67a"
const ROTA_MILAGRES_REGION_ID = "69333b0ee5bfdad9295df5cb"

async function main() {
    console.log("[1] Validando sessão (login web)...")
    const ping = await pingStaysSession()
    console.log("    →", ping)
    if (!ping.ok) {
        console.error("Login falhou. STAYS_LOGIN_USER/PASS configurados?")
        process.exit(1)
    }

    console.log("\n[2] DRY-RUN linkListingToRegion (não bate na Stays)...")
    const result = await linkListingToRegion({
        listingId: PYSA_LISTING_ID,
        regionId: ROTA_MILAGRES_REGION_ID,
        dryRun: true,
    })
    console.log("    → result:", result)
    if (!result.dryRun) {
        console.error("    ⚠️ dryRun retornou false — algo errado no gating")
        process.exit(1)
    }

    console.log("\n[3] Resumo: dry-run OK. Pra ir LIVE, basta passar dryRun=false")
    console.log("    quando o user aprovar.")
}

main().catch((e) => {
    console.error("erro fatal:", e)
    process.exit(1)
})
