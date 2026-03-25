import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    if (!supabaseUrl || !supabaseKey) return null
    return createClient(supabaseUrl, supabaseKey)
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { basket_id, airbnb_listing_id, internal_property_id, item_type, is_primary } = body

        if (!basket_id) {
            console.error('[API] Missing required field: basket_id')
            return NextResponse.json({ success: false, error: 'Basket ID is required' }, { status: 400 })
        }

        const supabase = getSupabase()
        if (!supabase) {
            return NextResponse.json({ success: false, error: 'Supabase client not initialized' }, { status: 500 })
        }

        // Determine item type and validate required fields
        const type = item_type || (internal_property_id ? 'internal' : 'external')

        if (type === 'internal') {
            if (!internal_property_id) {
                return NextResponse.json({ success: false, error: 'Internal Property ID is required for internal items' }, { status: 400 })
            }

            const { data, error } = await supabase
                .from('basket_items')
                .insert([{
                    basket_id,
                    item_type: 'internal',
                    internal_property_id,
                    is_primary: is_primary || false
                }])
                .select()
                .single()

            if (error) {
                console.error('[API] Supabase error adding internal property:', error)
                throw error
            }

            return NextResponse.json({ success: true, data })

        } else {
            // External competitor
            if (!airbnb_listing_id) {
                return NextResponse.json({ success: false, error: 'Airbnb Listing ID is required for external items' }, { status: 400 })
            }

            const listingId = airbnb_listing_id.toString()

            const { data, error } = await supabase
                .from('basket_items')
                .insert([{
                    basket_id,
                    item_type: 'external',
                    airbnb_listing_id: listingId,
                    is_primary: is_primary || false
                }])
                .select()
                .single()

            if (error) {
                console.error('[API] Supabase error adding external competitor:', error)
                throw error
            }

            return NextResponse.json({ success: true, data })
        }
    } catch (error: any) {
        console.error('[API] Final error adding item to basket:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed'
        }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ success: false, error: 'Item ID is required' }, { status: 400 })
        }

        const supabase = getSupabase()
        if (!supabase) {
            return NextResponse.json({ success: false, error: 'Supabase client not initialized' }, { status: 500 })
        }

        const { error } = await supabase
            .from('basket_items')
            .delete()
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Error deleting item from basket:', error)
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
    }
}
export async function PATCH(request: Request) {
    try {
        const body = await request.json()
        const { id, is_primary, basket_id } = body

        if (!id) {
            return NextResponse.json({ success: false, error: 'Item ID is required' }, { status: 400 })
        }

        const supabase = getSupabase()
        if (!supabase) {
            return NextResponse.json({ success: false, error: 'Supabase client not initialized' }, { status: 500 })
        }

        // If setting as primary, unset others in the same basket
        if (is_primary && basket_id) {
            await supabase
                .from('basket_items')
                .update({ is_primary: false })
                .eq('basket_id', basket_id)
        }

        const { data, error } = await supabase
            .from('basket_items')
            .update({ is_primary })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error) {
        console.error('[API] Error updating item:', error)
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
    }
}
