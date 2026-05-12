/**
 * Smoke test do degrau 3: cria um rascunho via createDraftReport().
 * Uso: npx tsx scripts/smoke-owner-report.ts <idpropriedade> <ini> <fim>
 *   ex: npx tsx scripts/smoke-owner-report.ts WW06H 2026-04-01 2026-04-30
 */

import { config as dotenv } from "dotenv"
dotenv({ path: ".env.local" })
import { createDraftReport } from "@/lib/owner-report/service"
import { getOwnerReport } from "@/lib/owner-report/repository"

async function main() {
  const [idprop, ini, fim] = process.argv.slice(2)
  if (!idprop || !ini || !fim) {
    console.error("Uso: tsx scripts/smoke-owner-report.ts <idprop> <ini> <fim>")
    process.exit(1)
  }

  console.log("→ createDraftReport", { idprop, ini, fim })
  const result = await createDraftReport({
    createdByEmail: "smoke@qaviimob.local",
    idpropriedade: idprop,
    periodo: { ini, fim },
  })

  if (!result.ok) {
    console.error("✗ falhou:", result.error)
    process.exit(1)
  }

  const { report } = result
  console.log("✓ criado id =", report.id)
  console.log("  unidade   :", report.nome_propriedade)
  console.log("  periodo   :", report.periodo_inicio, "→", report.periodo_fim)
  console.log("  slides    :", report.slides.map((s) => `${s.visible ? "✓" : "·"} ${s.key}`).join(", "))
  console.log(
    "  snapshot KPIs:",
    JSON.stringify((report.snapshot_data as any)?.resumoExecutivo?.kpis, null, 2)
  )

  const refetched = await getOwnerReport(report.id)
  console.log(refetched ? "✓ read-back OK" : "✗ read-back FALHOU")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
