/**
 * Reprocessa o enrichment da Pysa pra popular pricing_config com as 20 seasons
 * que agora existem na Stays (após nossos testes anteriores).
 *
 * Roda:
 *   node --env-file=.env.local node_modules/.bin/jiti scripts/reprocess-pysa.ts
 */

import { getOnboarding } from "../lib/onboarding/repository"
import { runEnrichmentInBackground } from "../lib/onboarding/pipeline"
import type { JestorPayload } from "../lib/onboarding/types"

const PYSA_ONBOARDING_ID = "8e55677a-d169-4379-822f-6097eae7c6b4"

async function main() {
    console.log("[1] Buscando row da Pysa...")
    const row = await getOnboarding(PYSA_ONBOARDING_ID)
    if (!row) {
        console.error("Pysa não encontrada")
        process.exit(1)
    }
    console.log("  idpropriedade:", row.idpropriedade)
    console.log("  state:", row.state)

    console.log("\n[2] Disparando runEnrichmentInBackground (NÃO aguardamos — é fire-and-forget)...")
    runEnrichmentInBackground(
        row.id,
        row.idpropriedade,
        row.jestor_payload as unknown as JestorPayload,
    )

    // Aguardamos 90s pra dar tempo do pipeline rodar (BQ + Stays + Gemini)
    console.log("\n[3] Aguardando 90s pro pipeline completar...")
    await new Promise((r) => setTimeout(r, 90_000))

    console.log("\n[4] Re-checando estado após reprocess:")
    const after = await getOnboarding(PYSA_ONBOARDING_ID)
    const r = after as unknown as Record<string, unknown>
    const pc = r.pricing_config as { seasons?: unknown[] } | null
    const snap = r.stays_snapshot_seasons as { items?: unknown[] } | null
    console.log("  pricing_config.seasons:", pc?.seasons?.length ?? 0)
    console.log("  stays_snapshot_seasons.items:", snap?.items?.length ?? 0)
    console.log("  stays_region_id:", r.stays_region_id)
    console.log("  stays_region_name:", r.stays_region_name)
}

main().catch((e) => {
    console.error("erro fatal:", e)
    process.exit(1)
})
