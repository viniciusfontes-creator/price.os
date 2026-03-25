import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const AIRBNB_URL_REGEX = /airbnb\.com.*\/rooms\/(\d+)/

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { url, basket_id } = body

        if (!url || !basket_id) {
            return NextResponse.json(
                { success: false, error: 'URL e basket_id são obrigatórios' },
                { status: 400 }
            )
        }

        // Validate Airbnb URL format
        const match = url.match(AIRBNB_URL_REGEX)
        if (!match || !match[1]) {
            return NextResponse.json(
                { success: false, error: 'URL inválida. Use o formato: https://www.airbnb.com/rooms/{id}' },
                { status: 400 }
            )
        }

        const airbnbId = match[1]

        // Check if already exists in this basket
        const { data: existingItem } = await supabase
            .from('basket_items')
            .select('id')
            .eq('basket_id', basket_id)
            .eq('airbnb_listing_id', airbnbId)
            .maybeSingle()

        if (existingItem) {
            return NextResponse.json(
                { success: false, error: 'Este concorrente já está na cesta' },
                { status: 409 }
            )
        }

        // GLOBAL CHECK: Check if exists in ANY other basket
        const { data: existingInOtherBasket } = await supabase
            .from('basket_items')
            .select(`
                id,
                basket_id,
                competitor_baskets!inner(id, name)
            `)
            .eq('airbnb_listing_id', airbnbId)
            .neq('basket_id', basket_id)
            .limit(1)
            .maybeSingle()

        if (existingInOtherBasket) {
            // URL exists in another basket - suggest reuse
            const basketData = existingInOtherBasket.competitor_baskets as any
            return NextResponse.json({
                success: false,
                error: 'exists_in_other_basket',
                existingBasket: {
                    id: existingInOtherBasket.basket_id,
                    name: basketData?.name || 'Cesta sem nome',
                    itemId: existingInOtherBasket.id
                },
                airbnb_id: airbnbId,
                canReuse: true
            }, { status: 409 })
        }

        // Check if URL exists in airbnb_extrações (already scraped)
        // Use the newly indexed id_numerica for instant lookup
        const { data: existsInExtractions } = await supabase
            .from('airbnb_extrações')
            .select('id')
            .eq('id_numerica', airbnbId)
            .limit(1)
            .maybeSingle();

        const matched = !!existsInExtractions;

        // Add to basket
        const { data: newItem, error: insertError } = await supabase
            .from('basket_items')
            .insert([{
                basket_id,
                item_type: 'external',
                airbnb_listing_id: airbnbId,
                is_primary: false
            }])
            .select()
            .single()

        if (insertError) {
            console.error('[API] Error adding URL to basket:', insertError)
            throw insertError
        }

        return NextResponse.json({
            success: true,
            data: newItem,
            matched,
            airbnb_id: airbnbId
        })
    } catch (error: any) {
        console.error('[API] Error in add-url:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Erro interno' },
            { status: 500 }
        )
    }
}
