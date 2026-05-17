/**
 * Verifica autenticidade dos webhooks recebidos da Stays.
 *
 * Descoberto empiricamente (2026-05-17): Stays NÃO usa Basic auth nos
 * webhooks. Envia 3 headers identificadores:
 *   - x-stays-api-hook: "1"
 *   - x-stays-name: "{tenant}"           (no nosso caso "beto")
 *   - x-stays-signature: "..."           (RSA SHA256 base64, ~700 chars)
 *
 * Validação atual: confere os 2 primeiros headers + tenant esperado.
 * Pega spam óbvio mas é falsificável por quem conhecer o esquema.
 *
 * TODO: subir para validação criptográfica da x-stays-signature quando
 * tivermos a chave pública da Stays (provavelmente em /external/v1/docs/
 * ou via suporte). Aí esse helper fica defense-in-depth.
 */

import type { NextRequest } from "next/server"

const EXPECTED_TENANT = "beto"

export interface StaysWebhookValidation {
    isStays: boolean
    tenant: string | null
    hasSignature: boolean
    reason?: string
}

export function validateStaysWebhook(req: NextRequest): StaysWebhookValidation {
    const hookFlag = req.headers.get("x-stays-api-hook")
    const tenant = req.headers.get("x-stays-name")
    const signature = req.headers.get("x-stays-signature")

    if (hookFlag !== "1") {
        return { isStays: false, tenant, hasSignature: !!signature, reason: "x-stays-api-hook ausente" }
    }
    if (!tenant || tenant !== EXPECTED_TENANT) {
        return { isStays: false, tenant, hasSignature: !!signature, reason: `tenant inesperado: ${tenant}` }
    }
    if (!signature) {
        return { isStays: false, tenant, hasSignature: false, reason: "x-stays-signature ausente" }
    }
    return { isStays: true, tenant, hasSignature: true }
}

/** Compatibilidade — retorna apenas o boolean. Em dev passa sempre. */
export function verifyStaysWebhookAuth(req: NextRequest): boolean {
    if (process.env.NODE_ENV !== "production") return true
    return validateStaysWebhook(req).isStays
}
