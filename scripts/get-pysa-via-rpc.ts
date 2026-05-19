/**
 * Tenta múltiplos formatos de params pra apartment.getApartment, pra ler
 * o _idregion atual da Pysa.
 *
 *   npx tsx --env-file=.env.local scripts/get-pysa-via-rpc.ts
 */
import { staysJsonRpc, StaysSessionError } from "../lib/stays/session-client"

const PYSA_ID_LONG = "69d976283a4375e9d12ca67a"
const PYSA_ID_SHORT = "IQ05J"

async function tryRpc(label: string, params: unknown[]) {
    console.log(`\n[${label}]`)
    console.log("  params:", JSON.stringify(params).slice(0, 200))
    try {
        const r = await staysJsonRpc<unknown>("apartment.getApartment", params)
        const j = JSON.stringify(r)
        console.log("  → ok:", j.slice(0, 800))
        // se o body tem _idregion, exibir
        const obj = r as Record<string, unknown> | undefined
        if (obj && typeof obj === "object") {
            const keys = Object.keys(obj).filter((k) =>
                k.toLowerCase().includes("region"),
            )
            if (keys.length) {
                console.log("  → CHAVES REGION:")
                for (const k of keys) console.log(`     ${k}:`, (obj as Record<string, unknown>)[k])
            }
        }
    } catch (e) {
        if (e instanceof StaysSessionError) {
            console.log("  → erro:", e.status, JSON.stringify(e.body).slice(0, 200))
        } else {
            console.log("  → erro:", (e as Error).message)
        }
    }
}

async function main() {
    await tryRpc("A: ['', { _id: long }]", ["", { _id: PYSA_ID_LONG }])
    await tryRpc("B: ['', { _idapartment: short }]", ["", { _idapartment: PYSA_ID_SHORT }])
    await tryRpc("C: ['', PYSA_ID_LONG]", ["", PYSA_ID_LONG])
    await tryRpc("D: [PYSA_ID_LONG]", [PYSA_ID_LONG])
    await tryRpc("E: ['', { id: short }]", ["", { id: PYSA_ID_SHORT }])
}

main().catch((e) => {
    console.error("erro fatal:", e)
    process.exit(1)
})
