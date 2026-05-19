/**
 * Probe do método apartment.saveApartment — confirma que existe e aceita auth
 * por cookie, SEM efetivar mudança real.
 *
 * Estratégia: enviar payload com _id INVÁLIDO ("000000000000000000000000").
 * Resultados esperados:
 *   - "wrong params" / "not found" → método existe, auth OK, sem efeito
 *   - "JSONRPC from external" → ainda bloqueado (problema)
 *   - "Unauthorized" → cookie inválido (problema)
 *
 * Roda:
 *   node --env-file=.env.local node_modules/.bin/jiti scripts/probe-save-apartment.ts
 */

import { staysJsonRpc, StaysSessionError } from "../lib/stays/session-client"

const FAKE_LISTING_ID = "000000000000000000000000" // ObjectId inexistente
const ROTA_MILAGRES = "69333b0ee5bfdad9295df5cb"

async function probe(label: string, params: unknown[]) {
    console.log(`\n[probe ${label}]`)
    console.log("  params:", JSON.stringify(params))
    try {
        const res = await staysJsonRpc("apartment.saveApartment", params)
        console.log("  → ok:", JSON.stringify(res).slice(0, 300))
    } catch (e) {
        if (e instanceof StaysSessionError) {
            console.log("  → erro status:", e.status)
            console.log("  → body:", JSON.stringify(e.body).slice(0, 500))
        } else {
            console.log("  → erro:", (e as Error).message)
        }
    }
}

async function main() {
    await probe("A: payload mínimo só com _idregion", [
        "",
        { _id: FAKE_LISTING_ID, _idregion: ROTA_MILAGRES },
    ])

    await probe("B: payload com deff_curr + _t_unset (como o colab/devtools)", [
        "",
        {
            _id: FAKE_LISTING_ID,
            _idregion: ROTA_MILAGRES,
            deff_curr: "BRL",
            _t_unset: {},
        },
    ])

    await probe("C: payload SEM _id (provavelmente rejeita)", [
        "",
        { _idregion: ROTA_MILAGRES },
    ])
}

main().catch((e) => {
    console.error("erro fatal:", e)
    process.exit(1)
})
