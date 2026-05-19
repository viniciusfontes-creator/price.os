/**
 * Probe pra descobrir como setar price-mirror via JSON-RPC.
 *
 * Hipóteses:
 *   - apartment.saveApartment com campo _idPriceMaster ou _idPriceGroupMaster
 *   - método dedicado pricegroup.* ou priceMirror.*
 *
 * Estratégia: usar _id falso. Se método não existe, retorna "method not found".
 * Se método existe mas params errados, retorna "wrong params". Se aceita, valida.
 *
 *   npx tsx --env-file=.env.local scripts/probe-price-mirror.ts
 */

import { staysJsonRpc, StaysSessionError } from "../lib/stays/session-client"

const FAKE = "000000000000000000000000"
const PYSA = "69d976283a4375e9d12ca67a"

async function probe(label: string, method: string, params: unknown[]) {
    console.log(`\n[${label}] ${method}`)
    console.log("  params:", JSON.stringify(params).slice(0, 200))
    try {
        const r = await staysJsonRpc<unknown>(method, params)
        console.log("  → ok:", JSON.stringify(r).slice(0, 300))
    } catch (e) {
        if (e instanceof StaysSessionError) {
            console.log(`  → erro status=${e.status}`)
            console.log("    body:", JSON.stringify(e.body).slice(0, 300))
        } else {
            console.log("  → erro:", (e as Error).message)
        }
    }
}

async function main() {
    // Família 1: apartment.saveApartment com campos relacionados a master/mirror
    await probe(
        "A1 _idPriceMaster",
        "apartment.saveApartment",
        ["", { _id: FAKE, _idPriceMaster: PYSA }],
    )
    await probe(
        "A2 _idPriceGroupMaster",
        "apartment.saveApartment",
        ["", { _id: FAKE, _idPriceGroupMaster: PYSA }],
    )
    await probe(
        "A3 priceMaster",
        "apartment.saveApartment",
        ["", { _id: FAKE, priceMaster: PYSA }],
    )

    // Família 2: métodos dedicados a clone/price group
    await probe(
        "B1 priceGroup.setMaster",
        "priceGroup.setMaster",
        ["", { _idmaster: PYSA, _idmember: FAKE }],
    )
    await probe(
        "B2 priceGroup.addMember",
        "priceGroup.addMember",
        ["", { _idmaster: PYSA, _idmember: FAKE }],
    )
    await probe(
        "B3 priceGroup.save",
        "priceGroup.save",
        ["", { masterId: PYSA, memberIds: [FAKE] }],
    )
    await probe(
        "B4 priceGroup.savePriceGroup",
        "priceGroup.savePriceGroup",
        ["", { _idmaster: PYSA }],
    )
    await probe(
        "B5 apartment.setPriceMaster",
        "apartment.setPriceMaster",
        ["", { _idapartment: FAKE, _idmaster: PYSA }],
    )
    await probe(
        "B6 apartment.linkPriceGroup",
        "apartment.linkPriceGroup",
        ["", { _idapartment: FAKE, _idmaster: PYSA }],
    )
}

main().catch((e) => {
    console.error("erro fatal:", e)
    process.exit(1)
})
