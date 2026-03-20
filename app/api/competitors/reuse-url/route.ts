import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Endpoint para reutilizar um listing do Airbnb já indexado em outra cesta
 *
 * Cria um novo basket_item apontando para o mesmo airbnb_listing_id
 * sem necessidade de re-scraping dos dados
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { airbnb_listing_id, basket_id } = body

        if (!airbnb_listing_id || !basket_id) {
            return NextResponse.json(
                { success: false, error: 'airbnb_listing_id e basket_id são obrigatórios' },
                { status: 400 }
            )
        }

        // Verificar se a cesta de destino existe
        const { data: targetBasket, error: basketError } = await supabase
            .from('competitor_baskets')
            .select('id, name')
            .eq('id', basket_id)
            .maybeSingle()

        if (basketError || !targetBasket) {
            return NextResponse.json(
                { success: false, error: 'Cesta de destino não encontrada' },
                { status: 404 }
            )
        }

        // Verificar se o listing existe em alguma outra cesta (validação)
        const { data: sourceItem, error: sourceError } = await supabase
            .from('basket_items')
            .select('id, airbnb_listing_id')
            .eq('airbnb_listing_id', airbnb_listing_id)
            .limit(1)
            .maybeSingle()

        if (sourceError || !sourceItem) {
            return NextResponse.json(
                { success: false, error: 'Listing não encontrado em nenhuma cesta' },
                { status: 404 }
            )
        }

        // Verificar se já existe na cesta de destino
        const { data: existingInTarget } = await supabase
            .from('basket_items')
            .select('id')
            .eq('basket_id', basket_id)
            .eq('airbnb_listing_id', airbnb_listing_id)
            .maybeSingle()

        if (existingInTarget) {
            return NextResponse.json(
                { success: false, error: 'Este concorrente já está na cesta de destino' },
                { status: 409 }
            )
        }

        // Criar novo basket_item reutilizando o mesmo airbnb_listing_id
        const { data: newItem, error: insertError } = await supabase
            .from('basket_items')
            .insert([{
                basket_id,
                item_type: 'external',
                airbnb_listing_id,
                is_primary: false
            }])
            .select()
            .single()

        if (insertError) {
            console.error('[API] Error reusing URL:', insertError)
            throw insertError
        }

        // Verificar se dados já existem no airbnb_extrações
        const partialId = airbnb_listing_id.substring(0, 15)
        const { data: extractionData } = await supabase
            .from('airbnb_extrações')
            .select('id, nome_anuncio')
            .ilike('url_anuncio', `%rooms/${partialId}%`)
            .limit(1)
            .maybeSingle()

        return NextResponse.json({
            success: true,
            data: newItem,
            reused: true,
            hasData: !!extractionData,
            listingName: extractionData?.nome_anuncio || 'Nome não disponível',
            message: 'Concorrente reutilizado com sucesso! Dados já disponíveis.'
        })
    } catch (error: any) {
        console.error('[API] Error in reuse-url:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Erro interno' },
            { status: 500 }
        )
    }
}
