/**
 * Visibilidade de unidades em onboarding nas Views do Price.OS.
 *
 * Retorna a lista de idpropriedade que NÃO devem aparecer em Dashboard,
 * Pricing, Vendas, Concorrência etc. — porque ainda não foram ativadas
 * pelo operador. Cache de 60s para não martelar Supabase a cada request.
 *
 * Uso típico:
 *   const exclude = await getOnboardingExcludeIds()
 *   const sql = sqlAtivaFilter('p', exclude)
 */

import { getSupabaseAdmin } from "@/lib/supabase-server"

let cached: { value: string[]; expiresAt: number } | null = null
const TTL_MS = 60_000

export async function getOnboardingExcludeIds(): Promise<string[]> {
    const now = Date.now()
    if (cached && cached.expiresAt > now) return cached.value

    const supabase = getSupabaseAdmin()
    if (!supabase) {
        cached = { value: [], expiresAt: now + TTL_MS }
        return []
    }

    const { data, error } = await supabase
        .from("property_onboarding")
        .select("idpropriedade")
        .neq("state", "ativada")
        .neq("state", "arquivada")

    if (error) {
        console.error("[onboarding/visibility] fetch error:", error)
        return cached?.value ?? []
    }

    const ids = (data || []).map((r) => String(r.idpropriedade))
    cached = { value: ids, expiresAt: now + TTL_MS }
    return ids
}

/** Invalida o cache (chamado quando uma unidade é ativada/arquivada). */
export function invalidateOnboardingExcludeCache(): void {
    cached = null
}
