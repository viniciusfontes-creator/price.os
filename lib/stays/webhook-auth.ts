/**
 * Verifica Basic auth dos webhooks recebidos da Stays.
 *
 * Stays envia o cabeçalho `Authorization: Basic base64(client_id:client_secret)`
 * usando o MESMO par configurado em App Center > Stays API.
 *
 * Em produção, exige a env. Em dev (NODE_ENV !== "production"), passa para
 * facilitar testes locais — mesma estratégia do onboarding/webhook.
 */

import type { NextRequest } from "next/server"

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let result = 0
    for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return result === 0
}

export function verifyStaysWebhookAuth(req: NextRequest): boolean {
    const clientId = process.env.STAYS_CLIENT_ID
    const clientSecret = process.env.STAYS_CLIENT_SECRET

    if (!clientId || !clientSecret) {
        return process.env.NODE_ENV !== "production"
    }

    const header = req.headers.get("authorization") || ""
    if (!header.toLowerCase().startsWith("basic ")) return false

    const expected = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
    const received = header.slice(6).trim()
    return timingSafeEqual(expected, received)
}
