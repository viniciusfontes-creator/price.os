import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-client'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const location = searchParams.get('location') // query text
        const lat = searchParams.get('lat')
        const lon = searchParams.get('lon')
        const radius = parseFloat(searchParams.get('radius') || '10') // radius in KM
        const guests = parseInt(searchParams.get('guests') || '1')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        const limit = parseInt(searchParams.get('limit') || '500')
        const offset = parseInt(searchParams.get('offset') || '0')
        const includeStats = searchParams.get('includeStats') === 'true'

        let data: any[] | null = []
        let error: any = null
        let count: number | null = 0

        // Use RPC if lat/lon are provided
        if (lat && lon) {
            const latitude = parseFloat(lat)
            const longitude = parseFloat(lon)

            const { data: rpcData, error: rpcError } = await supabase.rpc('buscar_anuncios_geo_v2', {
                p_latitude: latitude,
                p_longitude: longitude,
                p_raio_km: radius,
                p_hospedes: guests,
                p_start_date: startDate || null,
                p_end_date: endDate || null
            })

            data = rpcData
            error = rpcError
            count = rpcData?.length || 0
        } else {
            // Fallback to traditional query
            let query = supabase
                .from('airbnb_extrações')
                .select(`
                    id,
                    id_numerica,
                    data_extracao,
                    checkin_formatado,
                    tipo_propriedade,
                    nome_anuncio,
                    preco_total,
                    quantidade_noites,
                    latitude,
                    longitude,
                    hospedes_adultos,
                    media_avaliacao,
                    preferido_hospedes,
                    url_anuncio
                `, { count: 'exact' })
                .order('checkin_formatado', { ascending: true })

            if (location) {
                query = query.ilike('tipo_propriedade', `%${location}%`)
            }
            if (startDate) {
                query = query.gte('checkin_formatado', startDate)
            }
            if (endDate) {
                query = query.lte('checkin_formatado', endDate)
            }

            const { data: selectData, error: selectError, count: selectCount } = await query.range(offset, offset + limit - 1)
            data = selectData
            error = selectError
            count = selectCount
        }

        if (error) throw error

        const rawData = data || []

        // Helper to extract Airbnb ID from URL (avoids JavaScript BigInt precision loss)
        // JavaScript cannot accurately represent integers > 9007199254740991
        // Airbnb IDs have 19 digits, so we extract from URL string which is always accurate
        const extractAirbnbId = (item: any): string => {
            // Priority 1: Extract from URL (always string, no precision loss)
            if (item.url_anuncio) {
                const match = item.url_anuncio.match(/rooms\/(\d+)/);
                if (match && match[1]) return match[1];
            }
            // Fallback: Convert id_numerica (may have precision loss for large numbers)
            return String(item.id_numerica || item.id);
        };

        // Group by extracted Airbnb ID to handle duplicates
        const groups: Record<string, any[]> = {}
        rawData.forEach(item => {
            const key = extractAirbnbId(item)
            if (!groups[key]) groups[key] = []
            groups[key].push({ ...item, _extracted_airbnb_id: key }) // Store extracted ID
        })

        const processedData = Object.values(groups).map(group => {
            // Sort group by data_extracao descending to find the latest
            const sortedGroup = group.sort((a, b) =>
                new Date(b.data_extracao).getTime() - new Date(a.data_extracao).getTime()
            )

            const latest = sortedGroup[0]
            const previous = sortedGroup.length > 1 ? sortedGroup[1] : null

            const latestPrice = latest.preco_total && latest.quantidade_noites
                ? parseFloat((Number(latest.preco_total) / Number(latest.quantidade_noites)).toFixed(2))
                : 0

            let trendPercent = 0
            if (previous) {
                const previousPrice = previous.preco_total && previous.quantidade_noites
                    ? parseFloat((Number(previous.preco_total) / Number(previous.quantidade_noites)).toFixed(2))
                    : 0

                if (previousPrice > 0) {
                    trendPercent = parseFloat((((latestPrice - previousPrice) / previousPrice) * 100).toFixed(1))
                }
            }

            return {
                ...latest,
                id: latest.id?.toString(),
                id_numerica: latest._extracted_airbnb_id, // Use extracted ID (precision-safe)
                dist_km: latest.distancia_km,
                preco_por_noite: latestPrice,
                trend_percent: trendPercent,
                history: sortedGroup,
                historico_precos: sortedGroup.map((item: any) => ({
                    data: item.data_extracao,
                    preco: Number(item.preco_total) / Number(item.quantidade_noites)
                }))
            }
        })

        // Stats calculation (Date Range Curve)
        // We need (Listing + Checkin) uniqueness here, not just Listing uniqueness.
        // We want to show the price evolution over the requested Check-in Range.
        let stats = null
        if (includeStats && rawData && rawData.length > 0) {
            // 1. Resolve Latest Extraction per (Listing + Checkin)
            // Map Key: listingID_checkinDate
            const uniqueDailyPoints: Record<string, any> = {}

            rawData.forEach(item => {
                // valid checkin date
                if (!item.checkin_formatado) return
                const date = item.checkin_formatado.toString().split('T')[0]
                const listingId = extractAirbnbId(item)

                const uniqueKey = `${listingId}_${date}`
                const currentPoint = uniqueDailyPoints[uniqueKey]

                const extractionDate = item.data_extracao ? new Date(item.data_extracao).getTime() : 0

                if (!currentPoint || extractionDate > currentPoint._extractionTimestamp) {
                    // Calculate normalized price
                    const price = (item.preco_total && item.quantidade_noites)
                        ? parseFloat((Number(item.preco_total) / Number(item.quantidade_noites)).toFixed(2))
                        : item.preco_por_noite

                    uniqueDailyPoints[uniqueKey] = {
                        ...item,
                        _price: price,
                        _extractionTimestamp: extractionDate,
                        _date: date,
                        _listingId: listingId
                    }
                }
            })

            // 2. Aggregate by Date for the Chart
            const dateGroups: Record<string, { sum: number, count: number, listings: Record<string, number> }> = {}

            Object.values(uniqueDailyPoints).forEach((point: any) => {
                const date = point._date
                const price = point._price

                if (!price) return

                if (!dateGroups[date]) {
                    dateGroups[date] = { sum: 0, count: 0, listings: {} }
                }

                dateGroups[date].sum += price
                dateGroups[date].count += 1

                // Add listing breakdown for interactivity
                if (point._listingId) {
                    dateGroups[date].listings[`listing_${point._listingId}`] = price
                }
            })

            stats = Object.entries(dateGroups).map(([date, val]) => ({
                date,
                avgPrice: parseFloat((val.sum / val.count).toFixed(2)),
                ...val.listings
            })).sort((a, b) => a.date.localeCompare(b.date))
        }

        return NextResponse.json(sanitizeBigInt({
            success: true,
            data: processedData,
            stats,
            count: processedData.length,
        }))
    } catch (error) {
        console.error('[API] Error fetching competitors from Supabase:', error)
        return NextResponse.json({
            success: false,
            error: 'Failed',
            details: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 })
    }
}

function sanitizeBigInt(data: any): any {
    if (typeof data === 'bigint') {
        return data.toString()
    }
    if (Array.isArray(data)) {
        return data.map(sanitizeBigInt)
    }
    if (data !== null && typeof data === 'object') {
        if (data instanceof Date) return data;

        const newObj: any = {}
        for (const key in data) {
            newObj[key] = sanitizeBigInt(data[key])
        }
        return newObj
    }
    return data
}
