/**
 * POST /api/onboarding/:id/apply-basket
 *
 * Aplica a basket de concorrentes sugerida. Duas modalidades:
 *
 *   1. Adicionar a basket existente:
 *      { action: "add_to_existing", basketId: string,
 *        selectedItemIds?: number[] }
 *      → Insere os listings Airbnb sugeridos como items externos na basket
 *        existente. Não duplica items.
 *
 *   2. Criar nova basket:
 *      { action: "create_new", name?: string,
 *        selectedItemIds?: number[] }
 *      → Cria competitor_baskets vinculado à internal_property_id (idprop)
 *        e insere os items. Default name = "Onboarding · <idprop>".
 *
 * GET /api/onboarding/baskets/list (auxiliar)  — não implementado aqui, ver
 * lista direta via /api/competitors/* existente.
 */

import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { getOnboarding, logEvent, updateOnboarding } from "@/lib/onboarding/repository"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface ApplyBody {
    action: "add_to_existing" | "create_new"
    basketId?: string
    name?: string
    selectedItemIds?: number[]
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: ApplyBody
    try {
        body = (await req.json()) as ApplyBody
    } catch {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 })
    }

    if (body.action !== "add_to_existing" && body.action !== "create_new") {
        return NextResponse.json({ error: "action inválida" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: "DB indisponível" }, { status: 503 })

    const row = await getOnboarding(params.id)
    if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    const suggestedItems =
        (row.suggested_basket as { items?: Array<{ id_numerica: number; nome_anuncio?: string }> } | null)?.items || []
    if (suggestedItems.length === 0) {
        return NextResponse.json({ error: "Sem sugestões para aplicar" }, { status: 400 })
    }

    const selected =
        body.selectedItemIds && body.selectedItemIds.length > 0
            ? suggestedItems.filter((it) => body.selectedItemIds!.includes(it.id_numerica))
            : suggestedItems

    if (selected.length === 0) {
        return NextResponse.json({ error: "Nenhum item selecionado" }, { status: 400 })
    }

    let basketId: string

    if (body.action === "create_new") {
        const name = body.name?.trim() || `Onboarding · ${row.idpropriedade}`
        const { data: basket, error } = await supabase
            .from("competitor_baskets")
            .insert({ name, internal_property_id: row.idpropriedade })
            .select("id")
            .single()
        if (error || !basket) {
            return NextResponse.json(
                { error: `Falha ao criar basket: ${error?.message}` },
                { status: 500 }
            )
        }
        basketId = basket.id as string

        // Insere a própria unidade como item interno
        await supabase.from("basket_items").insert({
            basket_id: basketId,
            item_type: "internal",
            internal_property_id: row.idpropriedade,
            airbnb_listing_id: null,
        })
    } else {
        if (!body.basketId) {
            return NextResponse.json({ error: "basketId obrigatório para add_to_existing" }, { status: 400 })
        }
        basketId = body.basketId
        // Valida que a basket existe
        const { data: basket } = await supabase
            .from("competitor_baskets")
            .select("id")
            .eq("id", basketId)
            .maybeSingle()
        if (!basket) {
            return NextResponse.json({ error: "Basket não encontrada" }, { status: 404 })
        }
    }

    // Insere os listings externos selecionados (anti-duplicação por id)
    const { data: existingItems } = await supabase
        .from("basket_items")
        .select("airbnb_listing_id")
        .eq("basket_id", basketId)
        .eq("item_type", "external")

    const existingSet = new Set(
        (existingItems || []).map((i) => String(i.airbnb_listing_id))
    )

    const newRows = selected
        .filter((it) => !existingSet.has(String(it.id_numerica)))
        .map((it) => ({
            basket_id: basketId,
            item_type: "external",
            airbnb_listing_id: String(it.id_numerica),
            internal_property_id: null,
        }))

    let inserted = 0
    if (newRows.length > 0) {
        const { error: insErr } = await supabase.from("basket_items").insert(newRows)
        if (insErr) {
            return NextResponse.json(
                { error: `Falha ao inserir items: ${insErr.message}` },
                { status: 500 }
            )
        }
        inserted = newRows.length
    }

    await updateOnboarding(row.id, {
        approved_basket_id: basketId,
        approved_by: session.user.email,
    })

    await logEvent(row.id, row.idpropriedade, "basket_applied", {
        action: body.action,
        basketId,
        items_selected: selected.length,
        items_inserted: inserted,
        items_skipped_duplicate: selected.length - inserted,
        actor: session.user.email,
    })

    return NextResponse.json({
        success: true,
        basketId,
        items_selected: selected.length,
        items_inserted: inserted,
        items_skipped_duplicate: selected.length - inserted,
    })
}
