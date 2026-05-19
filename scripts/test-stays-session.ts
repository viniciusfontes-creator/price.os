/**
 * Smoke test do session-client da Stays.
 *
 * Roda:
 *   node --env-file=.env.local node_modules/.bin/jiti scripts/test-stays-session.ts
 *
 * Verifica:
 *   1. Login web → recebe cookie + uid
 *   2. JSON-RPC inócuo (apartment.list ou apartment.getApartment com id válido)
 */

import { pingStaysSession, staysJsonRpc, clearStaysSession } from "../lib/stays/session-client"

async function main() {
    clearStaysSession()
    console.log("[1] ping login...")
    const ping = await pingStaysSession()
    console.log("    →", ping)
    if (!ping.ok) {
        console.error("Login falhou. Verifique STAYS_LOGIN_USER / STAYS_LOGIN_PASS.")
        process.exit(1)
    }

    console.log("[2] JSON-RPC inócuo (apartment.getApartment com id curto LO01H)...")
    try {
        const res = await staysJsonRpc<unknown>("apartment.getApartment", ["", { _idapartment: "LO01H" }])
        console.log("    → resposta:", JSON.stringify(res).slice(0, 200))
    } catch (e: unknown) {
        const err = e as { message?: string; status?: number; body?: unknown }
        console.log("    → erro:", err.status, err.message)
        console.log("    → body:", err.body)
    }
}

main().catch((e) => {
    console.error("Erro fatal:", e)
    process.exit(1)
})
