import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-client'
import { getTarifario, getPropriedades } from '@/lib/bigquery-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const withHistory = searchParams.get('withHistory') === 'true'

    try {
        // 1. Fetch Baskets and their items
        let query = supabase
            .from('competitor_baskets')
            .select('*, basket_items(*)')

        // Legacy support: filter by baskets that have this property as an internal item
        if (propertyId) {
            // Get basket IDs that contain this property as an internal item
            const { data: basketsWithProperty } = await supabase
                .from('basket_items')
                .select('basket_id')
                .eq('item_type', 'internal')
                .eq('internal_property_id', propertyId)

            const basketIds = basketsWithProperty?.map((b: any) => b.basket_id) || []

            if (basketIds.length > 0) {
                query = query.in('id', basketIds)
            } else {
                // No baskets for this property
                return NextResponse.json({ success: true, data: [] })
            }
        }

        const { data: rawBaskets, error: basketsError } = await query
        if (basketsError) throw basketsError

        if (!rawBaskets || rawBaskets.length === 0) {
            return NextResponse.json({ success: true, data: [] })
        }

        // Map IDs to strings immediately to avoid precision loss
        const baskets = rawBaskets.map((b: any) => ({
            ...b,
            id: b.id.toString(),
            internal_property_id: b.internal_property_id?.toString(),
            basket_items: b.basket_items?.map((i: any) => ({
                ...i,
                id: i.id.toString(),
                basket_id: i.basket_id.toString(),
                airbnb_listing_id: i.airbnb_listing_id?.toString(),
                internal_property_id: i.internal_property_id?.toString(),
                item_type: i.item_type || 'external' // Default for legacy data
            }))
        }))

        // 2. Separate internal and external items
        const allExternalIds: string[] = []
        const allInternalIds: string[] = []

        baskets.forEach((basket: any) => {
            basket.basket_items?.forEach((item: any) => {
                if (item.item_type === 'external' && item.airbnb_listing_id) {
                    allExternalIds.push(item.airbnb_listing_id)
                } else if (item.item_type === 'internal' && item.internal_property_id) {
                    allInternalIds.push(item.internal_property_id)
                }
            })
        })

        // Helper to extract Airbnb ID from URL (avoids JavaScript BigInt precision loss)
        const extractAirbnbId = (urlOrItem: any): string => {
            const url = typeof urlOrItem === 'string' ? urlOrItem : urlOrItem?.url_anuncio;
            if (url) {
                const match = url.match(/rooms\/(\d+)/);
                if (match && match[1]) return match[1];
            }
            // Fallback (may have precision loss for large numbers)
            return String(urlOrItem?.id_numerica || urlOrItem?.id || '');
        };

        // 3. Fetch external competitor data (Airbnb listings)
        if (allExternalIds.length > 0 && withHistory) {
            // Build URL patterns for search (e.g., '%rooms/1234567%')
            // We use OR filtering since Supabase doesn't support regex well
            // For efficiency, fetch all matching URLs and filter in memory

            const urlPatterns = allExternalIds.map(id => `%rooms/${id}%`);

            // For precision-safe matching, use first 15 digits of the ID
            // JavaScript can only safely represent integers up to 2^53 - 1 (about 16 digits)
            // Airbnb IDs have 19 digits, so we use partial matching with the safe portion
            const historyPromises = allExternalIds.map(id => {
                // Use first 15 digits for safe partial matching
                const safePartialId = id.toString().substring(0, 15);
                return supabase
                    .from('airbnb_extrações')
                    .select('*')
                    .ilike('url_anuncio', `%rooms/${safePartialId}%`)
                    .order('data_extracao', { ascending: false });
            });

            const historyResults = await Promise.all(historyPromises);

            // Flatten all results
            const allHistory: any[] = [];
            historyResults.forEach(result => {
                if (result.data) allHistory.push(...result.data);
            });

            // Map data back to baskets
            baskets.forEach((basket: any) => {
                basket.basket_items?.forEach((item: any) => {
                    if (item.item_type !== 'external') return

                    // Use first 15 digits for safe matching (avoids precision loss issues)
                    const itemPartialId = item.airbnb_listing_id?.toString().substring(0, 15);

                    // Find all history for this item by matching first 15 digits of URL ID
                    const itemHistory = allHistory.filter(h => {
                        const historyId = extractAirbnbId(h);
                        const historyPartialId = historyId.substring(0, 15);
                        return historyPartialId === itemPartialId;
                    }) || []

                    item.history = itemHistory

                    // Set snapshot data (latest extraction found)
                    if (itemHistory.length > 0) {
                        // Get the real ID from the URL for correct linking
                        item.airbnb_data = {
                            ...itemHistory[0],
                            // Override with extracted ID to ensure URL precision
                            id_numerica: extractAirbnbId(itemHistory[0])
                        };
                    }
                })
            })
        }

        // 4. Fetch internal property data
        if (allInternalIds.length > 0) {
            const properties = await getPropriedades().catch(err => {
                console.error('[API] Properties error:', err);
                return [];
            });

            const allTarifario = withHistory ? await getTarifario().catch(err => {
                console.error('[API] Error fetching tarifario', err);
                return [];
            }) : [];

            if (properties && properties.length > 0) {
                baskets.forEach((basket: any) => {
                    basket.basket_items?.forEach((item: any) => {
                        if (item.item_type !== 'internal') return

                        const property = properties.find(p => p.idpropriedade?.toString() === item.internal_property_id?.toString())
                        if (property) {
                            item.internal_property_data = property

                            const propTarifario = allTarifario.filter(t => t.idpropriedade?.toString() === property.idpropriedade?.toString());
                            const customHistory: any[] = [];

                            if (withHistory && propTarifario.length > 0) {
                                // Calculate Holidays dynamically
                                const calcEaster = (year: number) => {
                                    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
                                    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
                                    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
                                    const m = Math.floor((a + 11 * h + 22 * l) / 451);
                                    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1, day = ((h + l - 7 * m + 114) % 31) + 1;
                                    return new Date(Date.UTC(year, month, day));
                                }

                                const today = new Date();
                                const maxLimit = new Date(); maxLimit.setDate(maxLimit.getDate() + 365);

                                const holidays: Record<string, number> = {};
                                [today.getFullYear(), today.getFullYear() + 1].forEach(y => {
                                    const easter = calcEaster(y);

                                    const sextaSanta = new Date(easter); sextaSanta.setUTCDate(easter.getUTCDate() - 2);
                                    holidays[sextaSanta.toISOString().substring(0, 10)] = 3; // 3 nights

                                    const carnaval = new Date(easter); carnaval.setUTCDate(easter.getUTCDate() - 50);
                                    holidays[carnaval.toISOString().substring(0, 10)] = 4; // 4 nights

                                    const rev = new Date(Date.UTC(y, 11, 28));
                                    holidays[rev.toISOString().substring(0, 10)] = 5; // 5 nights
                                });

                                // Check each day from today to +365
                                for (let d = new Date(today); d <= maxLimit; d.setDate(d.getDate() + 1)) {
                                    const dateStr = d.toISOString().substring(0, 10);

                                    // Verify if it's a holiday or weekend (Friday/Saturday)
                                    const isWeekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;
                                    const holidayNights = holidays[dateStr];

                                    if (isWeekend || holidayNights) {
                                        // Find applicable rate
                                        const applicableTarifario = propTarifario.find(t => {
                                            const startStr = typeof t.from === 'object' ? t.from.value : String(t.from);
                                            const startDate = new Date(startStr);
                                            const endDate = new Date(String(t.to));
                                            return d >= startDate && d <= endDate;
                                        });

                                        if (applicableTarifario && applicableTarifario.baserate) {
                                            customHistory.push({
                                                checkin_formatado: d.toISOString(),
                                                data_extracao: new Date().toISOString(),
                                                preco_por_noite: applicableTarifario.baserate,
                                                holiday_calc: !!holidayNights
                                            });
                                        }
                                    }
                                }
                            }
                            item.history = customHistory;
                        }
                    })
                })
            }
        }

        return NextResponse.json({ success: true, data: baskets })
    } catch (error) {
        console.error('[API] Error fetching baskets:', error)
        return NextResponse.json({ success: false, error: 'Failed to fetch baskets' }, { status: 500 })
    }
}
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ success: false, error: 'Basket ID is required' }, { status: 400 })
        }

        // 1. Delete items first (though Supabase might handle cascade if defined, let's be safe)
        await supabase.from('basket_items').delete().eq('basket_id', id)

        // 2. Delete basket
        const { error } = await supabase
            .from('competitor_baskets')
            .delete()
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Error deleting basket:', error)
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { name, internal_property_id, internal_property_ids, location, guest_capacity } = body

        if (!name) {
            console.error('[API] Missing required field: name')
            return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
        }

        // Create basket with typology metadata
        const { data: basket, error: basketError } = await supabase
            .from('competitor_baskets')
            .insert([{
                name,
                internal_property_id: null,
                location,
                guest_capacity
            }])
            .select()
            .single()

        if (basketError) {
            console.error('[API] Supabase error creating basket:', basketError)
            throw basketError
        }

        // Add internal properties if provided
        const propertyIds = internal_property_ids || (internal_property_id ? [internal_property_id] : [])

        if (propertyIds.length > 0) {
            const itemsToInsert = propertyIds.map((propId: string) => ({
                basket_id: basket.id,
                item_type: 'internal',
                internal_property_id: propId
            }))

            const { error: itemsError } = await supabase
                .from('basket_items')
                .insert(itemsToInsert)

            if (itemsError) {
                console.error('[API] Error adding internal properties:', itemsError)
                // Don't fail the whole request, just log the error
            }
        }

        return NextResponse.json({ success: true, data: basket })
    } catch (error: any) {
        console.error('[API] Final error creating basket:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to create basket',
            details: error
        }, { status: 500 })
    }
}

export async function PATCH(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ success: false, error: 'Basket ID is required' }, { status: 400 })
        }

        const body = await request.json()
        const { name, location, guest_capacity, internal_property_ids } = body

        // Update basket metadata
        const updateData: any = {}
        if (name !== undefined) updateData.name = name
        if (location !== undefined) updateData.location = location
        if (guest_capacity !== undefined) updateData.guest_capacity = guest_capacity

        const { error: updateError } = await supabase
            .from('competitor_baskets')
            .update(updateData)
            .eq('id', id)

        if (updateError) {
            console.error('[API] Error updating basket:', updateError)
            throw updateError
        }

        // Update internal properties if provided
        if (internal_property_ids !== undefined) {
            // Delete existing internal items
            await supabase
                .from('basket_items')
                .delete()
                .eq('basket_id', id)
                .eq('item_type', 'internal')

            // Insert new internal items
            if (internal_property_ids.length > 0) {
                const itemsToInsert = internal_property_ids.map((propId: string) => ({
                    basket_id: id,
                    item_type: 'internal',
                    internal_property_id: propId
                }))

                const { error: itemsError } = await supabase
                    .from('basket_items')
                    .insert(itemsToInsert)

                if (itemsError) {
                    console.error('[API] Error updating internal properties:', itemsError)
                    throw itemsError
                }
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[API] Error updating basket:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to update basket',
            details: error
        }, { status: 500 })
    }
}
