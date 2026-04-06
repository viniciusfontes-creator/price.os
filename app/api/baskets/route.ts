import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-client'
import { getTarifario, getPropriedades } from '@/lib/bigquery-service'
import { serverCache, CACHE_KEYS } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const withHistory = searchParams.get('withHistory') === 'true'
    // mode: 'snapshot' = latest data per competitor (fast), 'full' = complete history
    const mode = withHistory ? 'full' : (searchParams.get('mode') || 'full')

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
        if (allExternalIds.length > 0 && (mode === 'full' || mode === 'snapshot')) {
            // Step A: Try exact match on id_numerica (fast, uses index)
            const { data: allHistoryData, error: historyError } = await supabase
                .from('airbnb_extrações')
                .select('*')
                .in('id_numerica', allExternalIds)
                .gt('preco_total', 0)
                .order('data_extracao', { ascending: false });

            if (historyError) {
                console.error('[API] Error fetching history:', historyError);
            }

            let allHistory = allHistoryData || [];

            // Step B: Find which IDs were NOT matched
            // Using exact matching instead of substring prefixes to avoid collisions
            // If an ID is matched but it's lossy, it will trigger Step C fallback for accuracy.
            const matchedIds = new Set(
                allHistory.map(h => extractAirbnbId(h))
            );
            const unmatchedIds = allExternalIds.filter(
                id => !matchedIds.has(id)
            );

            // Step C: For unmatched IDs, query normalized tables (airbnb_propriedades + airbnb_precos)
            // The RPC buscar_concorrentes_v3 reads from these tables, but baskets only queried airbnb_extrações.
            // IMPORTANT: id_numerica is NUMERIC in PostgreSQL. The IDs from basket_items (extracted from URLs)
            // are precise, but the NUMERIC column has precision loss. We must search by URL, not by id_numerica.
            if (unmatchedIds.length > 0) {
                console.log(`[API] ${unmatchedIds.length} IDs not found in airbnb_extrações, querying normalized tables by URL...`);

                // Search airbnb_propriedades by URL (url_anuncio has correct full IDs)
                const urlOrConditions = unmatchedIds
                    .map(id => `url_anuncio.like.%rooms/${id}%`)
                    .join(',');

                const { data: propData, error: propError } = await supabase
                    .from('airbnb_propriedades')
                    .select('id_numerica, nome_anuncio, tipo_propriedade, url_anuncio, hospedes_adultos, media_avaliacao, latitude, longitude')
                    .or(urlOrConditions);

                if (propError) {
                    console.error('[API] airbnb_propriedades URL search error:', propError);
                }

                const foundProps = propData || [];

                if (foundProps.length > 0) {
                    console.log(`[API] Found ${foundProps.length} properties in airbnb_propriedades by URL`);

                    // Build a map: URL-extracted ID -> property data
                    // CRITICAL: id_numerica is NUMERIC in PostgreSQL but JavaScript loses precision
                    // for 19-digit numbers. We must use the URL-extracted string IDs for ALL queries.
                    const propMap = new Map<string, any>(); // urlId -> prop
                    const correctStringIds: string[] = []; // URL-extracted IDs (full precision)

                    foundProps.forEach((p: any) => {
                        const urlId = extractAirbnbId(p); // extract correct ID from url_anuncio
                        propMap.set(urlId, p);
                        correctStringIds.push(urlId); // PostgREST parses strings to exact NUMERIC
                    });

                    // Fetch price history using STRING IDs and date filters
                    // IMPORTANT: We filter by checkin date range to ensure we find old records
                    // for these specific IDs even if other properties have newer extractions.
                    let priceQuery = supabase
                        .from('airbnb_precos')
                        .select('id, id_numerica, data_extracao, checkin_formatado, preco_total, quantidade_noites, preferido_hospedes')
                        .in('id_numerica', correctStringIds)
                        .gt('preco_total', 0);

                    if (startDate) {
                        priceQuery = priceQuery.gte('checkin_formatado', startDate);
                    }
                    if (endDate) {
                        priceQuery = priceQuery.lte('checkin_formatado', endDate);
                    }

                    const { data: priceData, error: priceError } = await priceQuery
                        .order('data_extracao', { ascending: false })
                        .limit(5000); // Increased limit as we are filtering by IDs and Date

                    if (priceError) {
                        console.error('[API] airbnb_precos error:', priceError);
                    }

                    const prices = priceData || [];
                    console.log(`[API] Found ${prices.length} price records in airbnb_precos for ${correctStringIds.length} properties`);

                    // Build reverse map: JS-precision-loss id_numerica -> correct URL id
                    // price.id_numerica comes back as JS number (precision lost), e.g. 1311831924635536100
                    // We need to match it to the correct prop by comparing the lossy values
                    const lossyToCorrectId = new Map<number, string>();
                    const lossyToProp = new Map<number, any>();
                    foundProps.forEach((p: any) => {
                        const urlId = extractAirbnbId(p);
                        lossyToCorrectId.set(p.id_numerica, urlId); // lossy number -> correct string
                        lossyToProp.set(p.id_numerica, p);
                    });

                    const mergedRecords = prices.map((price: any) => {
                        const prop = lossyToProp.get(price.id_numerica);
                        const correctId = lossyToCorrectId.get(price.id_numerica) || String(price.id_numerica);
                        return {
                            id: price.id,
                            id_numerica: correctId,
                            data_extracao: price.data_extracao,
                            checkin_formatado: price.checkin_formatado,
                            preco_total: price.preco_total,
                            quantidade_noites: price.quantidade_noites,
                            preferido_hospedes: price.preferido_hospedes,
                            nome_anuncio: prop?.nome_anuncio,
                            tipo_propriedade: prop?.tipo_propriedade,
                            url_anuncio: prop?.url_anuncio,
                            hospedes_adultos: prop?.hospedes_adultos,
                            media_avaliacao: prop?.media_avaliacao,
                            latitude: prop?.latitude,
                            longitude: prop?.longitude,
                            preco_por_noite: price.preco_total && price.quantidade_noites
                                ? Number(price.preco_total) / Number(price.quantidade_noites)
                                : null,
                            _source: 'normalized'
                        };
                    });

                    if (mergedRecords.length > 0) {
                        console.log(`[API] Merged ${mergedRecords.length} records from normalized tables`);
                        allHistory = [...allHistory, ...mergedRecords];
                    }

                    // For properties found but with no prices, create minimal snapshot (at least show the name)
                    const propsWithPrices = new Set(
                        prices.map((pr: any) => lossyToCorrectId.get(pr.id_numerica) || String(pr.id_numerica))
                    );
                    const propsWithoutPrices = foundProps.filter((p: any) => !propsWithPrices.has(extractAirbnbId(p)));

                    if (propsWithoutPrices.length > 0) {
                        const minimalRecords = propsWithoutPrices.map((prop: any) => ({
                            id: null,
                            id_numerica: extractAirbnbId(prop),
                            data_extracao: null,
                            checkin_formatado: null,
                            preco_total: null,
                            quantidade_noites: null,
                            nome_anuncio: prop.nome_anuncio,
                            tipo_propriedade: prop.tipo_propriedade,
                            url_anuncio: prop.url_anuncio,
                            hospedes_adultos: prop.hospedes_adultos,
                            media_avaliacao: prop.media_avaliacao,
                            latitude: prop.latitude,
                            longitude: prop.longitude,
                            preco_por_noite: null,
                            _source: 'normalized_no_prices'
                        }));
                        allHistory = [...allHistory, ...minimalRecords];
                    }
                } else {
                    console.log(`[API] No properties found in normalized tables for IDs:`, unmatchedIds);
                }
            }

            // For snapshot mode, keep only the latest entry per listing
            if (mode === 'snapshot') {
                const latestByListing = new Map<string, any>();
                allHistory.forEach(h => {
                    const hId = extractAirbnbId(h).substring(0, 15);
                    if (!latestByListing.has(hId)) {
                        latestByListing.set(hId, h);
                    }
                });
                allHistory = Array.from(latestByListing.values());
            }

            // Map data back to baskets
            baskets.forEach((basket: any) => {
                basket.basket_items?.forEach((item: any) => {
                    if (item.item_type !== 'external') return

                    const itemHistory = allHistory.filter(h => {
                        const historyId = extractAirbnbId(h);
                        return historyId === item.airbnb_listing_id;
                    });

                    if (mode === 'full') {
                        item.history = itemHistory;
                    }

                    if (itemHistory.length > 0) {
                        const latest = itemHistory[0];
                        item.airbnb_data = {
                            ...latest,
                            id_numerica: extractAirbnbId(latest),
                            preco_por_noite: latest.preco_por_noite ||
                                (latest.preco_total && latest.quantidade_noites
                                    ? latest.preco_total / latest.quantidade_noites
                                    : null)
                        };
                    }
                })
            })
        }

        // 4. Fetch internal property data
        if (allInternalIds.length > 0) {
            const [properties, allTarifario] = await Promise.all([
                serverCache.getOrFetch(
                    CACHE_KEYS.BASKETS_PROPERTIES,
                    () => getPropriedades(),
                    300
                ).catch(err => { console.error('[API] Properties error:', err); return []; }),
                mode === 'full'
                    ? serverCache.getOrFetch(
                        CACHE_KEYS.BASKETS_TARIFARIO,
                        () => getTarifario(),
                        300
                    ).catch(err => { console.error('[API] Error fetching tarifario', err); return []; })
                    : Promise.resolve([])
            ]);

            if (properties && properties.length > 0) {
                baskets.forEach((basket: any) => {
                    basket.basket_items?.forEach((item: any) => {
                        if (item.item_type !== 'internal') return

                        const property = properties.find(p => p.idpropriedade?.toString() === item.internal_property_id?.toString())
                        if (property) {
                            item.internal_property_data = property

                            const propTarifario = allTarifario.filter(t => t.idpropriedade?.toString() === property.idpropriedade?.toString());
                            const customHistory: any[] = [];

                            if (mode === 'full' && propTarifario.length > 0) {
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
