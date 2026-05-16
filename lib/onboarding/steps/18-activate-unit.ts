/**
 * Step 18: Ativa a unidade — cria os registros derivados aprovados pelo
 * operador (basket de concorrentes) e marca a unidade como visível nas Views.
 *
 * Esta operação é destrutiva (cria registros em outras tabelas) e por isso
 * só roda quando o operador clica explicitamente em "Ativar" pela UI.
 */

import { getSupabaseAdmin } from "@/lib/supabase-server"
import {
    getOnboarding,
    logEvent,
    transitionState,
    updateOnboarding,
} from "../repository"
import { invalidateOnboardingExcludeCache } from "../visibility"

export interface ActivateInput {
    onboardingId: string
    operatorEmail: string
    createBasket: boolean
    /** Se omitido, usa suggested_baserate como approved_baserate. */
    approvedBaserate?: number | null
    /** Se omitido, marca como aprovada todos os itens de suggested_basket. */
    selectedBasketItemIds?: number[]
}

export interface ActivateResult {
    ok: boolean
    basketId?: string
    error?: string
}

export async function activateUnit(input: ActivateInput): Promise<ActivateResult> {
    const supabase = getSupabaseAdmin()
    if (!supabase) return { ok: false, error: "Supabase indisponível" }

    const row = await getOnboarding(input.onboardingId)
    if (!row) return { ok: false, error: "Onboarding não encontrado" }

    let createdBasketId: string | undefined

    // ---- Cria basket se solicitado e se há sugestão ----
    if (input.createBasket && row.suggested_basket) {
        const suggested = row.suggested_basket as {
            items?: Array<{ id_numerica: number; nome_anuncio?: string | null }>
        }

        const selected =
            input.selectedBasketItemIds && input.selectedBasketItemIds.length > 0
                ? (suggested.items || []).filter((it) =>
                      input.selectedBasketItemIds!.includes(it.id_numerica)
                  )
                : suggested.items || []

        if (selected.length > 0) {
            const basketName = `Onboarding · ${row.idpropriedade}`
            const { data: basket, error: bErr } = await supabase
                .from("competitor_baskets")
                .insert({
                    name: basketName,
                    internal_property_id: row.idpropriedade,
                })
                .select("id")
                .single()

            if (bErr) {
                return { ok: false, error: `Falha ao criar basket: ${bErr.message}` }
            }
            createdBasketId = basket?.id as string

            // Insere a unidade interna como item
            const internalItem = {
                basket_id: createdBasketId,
                item_type: "internal",
                airbnb_listing_id: null,
                internal_property_id: row.idpropriedade,
            }
            const externalItems = selected.map((it) => ({
                basket_id: createdBasketId,
                item_type: "external",
                airbnb_listing_id: String(it.id_numerica),
                internal_property_id: null,
            }))
            const { error: itemsErr } = await supabase
                .from("basket_items")
                .insert([internalItem, ...externalItems])
            if (itemsErr) {
                console.error("[onboarding/activate] basket_items insert error:", itemsErr)
            }
        }
    }

    // ---- Atualiza onboarding com decisões e transiciona ----
    const approvedBaserate =
        input.approvedBaserate != null ? input.approvedBaserate : row.suggested_baserate

    await updateOnboarding(input.onboardingId, {
        approved_by: input.operatorEmail,
        approved_baserate: approvedBaserate,
        approved_basket_id: createdBasketId ?? null,
        activated_at: new Date().toISOString(),
        operator_email: input.operatorEmail,
    })

    await transitionState(input.onboardingId, row.idpropriedade, "ativada")
    await logEvent(input.onboardingId, row.idpropriedade, "activated", {
        operator: input.operatorEmail,
        basket_id: createdBasketId,
        approved_baserate: approvedBaserate,
    })

    invalidateOnboardingExcludeCache()

    return { ok: true, basketId: createdBasketId }
}
