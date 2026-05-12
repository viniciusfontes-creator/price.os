/**
 * Share token: 256-bit aleatório armazenado em proprietario_reports.share_token.
 * URL pública: /print/owner-report/[id]?token=<share_token>
 * Validação ocorre na print page (compara contra row.share_token + share_expires_at).
 */

import { randomBytes } from "crypto"

export function generateShareToken(): string {
  return randomBytes(32).toString("base64url")
}

export function shareUrl(origin: string, id: string, token: string): string {
  return `${origin}/share/${id}?token=${encodeURIComponent(token)}`
}

export interface ShareValidation {
  valid: boolean
  reason?: "missing" | "mismatch" | "expired"
}

export function validateShare(
  providedToken: string | null,
  rowToken: string | null,
  rowExpiresAt: string | null
): ShareValidation {
  if (!providedToken || !rowToken) return { valid: false, reason: "missing" }
  if (providedToken !== rowToken) return { valid: false, reason: "mismatch" }
  if (rowExpiresAt && new Date(rowExpiresAt).getTime() < Date.now()) {
    return { valid: false, reason: "expired" }
  }
  return { valid: true }
}
