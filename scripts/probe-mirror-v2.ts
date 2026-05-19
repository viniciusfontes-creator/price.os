/**
 * Probe v2: validar nomes de método (existe vs não) e tentar campos
 * conhecidos da Stays pra price-mirror.
 *
 * Regra descoberta:
 *   - inexistente → body.method = "rpc/<name>" + subject BadRequest
 *   - existente   → body.method = "<name>" (sem rpc/) + subject específico
 *
 *   npx tsx --env-file=.env.local scripts/probe-mirror-v2.ts
 */
import { staysJsonRpc, StaysSessionError } from "../lib/stays/session-client"

type Result = { method: string; exists: boolean; subject?: string; msg?: string }
const results: Result[] = []

async function check(method: string, params: unknown[] = ["", {}]): Promise<void> {
    try {
        await staysJsonRpc(method, params)
        results.push({ method, exists: true, msg: "OK (sem erro)" })
    } catch (e) {
        if (e instanceof StaysSessionError) {
            const body = e.body as Record<string, unknown> | undefined
            const m = (body?.data as Record<string, unknown> | undefined)?.method as string | undefined
            const subject = (body?.data as Record<string, unknown> | undefined)?.subject as string | undefined
            const msg = body?.message as string | undefined
            const exists = !!m && !m.startsWith("rpc/")
            results.push({ method, exists, subject, msg })
        }
    }
}

async function main() {
    // Família clone (já sabemos que GET /content/clone-groups/X existe)
    await check("apartment.saveCloneGroup")
    await check("cloneGroup.save")
    await check("cloneGroup.create")
    await check("cloneGroup.addItem")
    await check("apartment.setClone")
    await check("apartment.setCloneGroup")
    await check("apartment.cloneFrom")

    // Família price
    await check("apartment.savePriceGroup")
    await check("apartment.setPriceGroup")
    await check("apartment.copyPriceFrom")
    await check("priceGroup.create")
    await check("priceGroup.update")

    // Variações com nome "Mirror"
    await check("apartment.setPriceMirror")
    await check("apartment.mirror")

    // Imprime resumo
    console.log("\n========== RESUMO ==========\n")
    const existing = results.filter((r) => r.exists)
    const missing = results.filter((r) => !r.exists)
    console.log(`✅ EXISTEM (${existing.length}):`)
    for (const r of existing) console.log(`   ${r.method} → ${r.subject} | ${r.msg?.slice(0, 80)}`)
    console.log(`\n❌ NÃO EXISTEM (${missing.length}):`)
    for (const r of missing) console.log(`   ${r.method}`)
}

main().catch(console.error)
