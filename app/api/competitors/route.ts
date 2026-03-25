import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { supabase as supabaseAnon } from '@/lib/supabase-client'

export async function GET(request: Request) {
    try {
        // Use service_role (server-side) for longer timeout (120s vs 3s anon)
        const supabase = getSupabaseAdmin() || supabaseAnon
        const { searchParams } = new URL(request.url)
        const location = searchParams.get('location') // query text
        const lat = searchParams.get('lat')
        const lon = searchParams.get('lon')
        const radius = parseFloat(searchParams.get('radius') || '10') // radius in KM
        const guestsMin = parseInt(searchParams.get('guestsMin') || searchParams.get('guests') || '1')
        const guestsMax = parseInt(searchParams.get('guestsMax') || '999')
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

            console.log('[API] Calling RPC buscar_concorrentes_v3 with params:', {
                latitude,
                longitude,
                radius,
                guestsMin,
                startDate,
                endDate
            })

            const { data: rpcData, error: rpcError } = await supabase.rpc('buscar_concorrentes_v3', {
                p_latitude: latitude,
                p_longitude: longitude,
                p_raio_km: radius,
                p_hospedes: guestsMin,
                p_start_date: startDate || null,
                p_end_date: endDate || null
            })

            if (rpcError) {
                console.error('[API] RPC Error:', {
                    message: rpcError.message,
                    details: rpcError.details,
                    hint: rpcError.hint,
                    code: rpcError.code
                })
            }

            data = rpcData
            error = rpcError

            // Apply max guest filter client-side (RPC only supports min)
            if (data && guestsMax < 999) {
                data = data.filter((item: any) => (item.hospedes_adultos || 0) <= guestsMax)
            }
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
            if (guestsMin > 1) {
                query = query.gte('hospedes_adultos', guestsMin)
            }
            if (guestsMax < 999) {
                query = query.lte('hospedes_adultos', guestsMax)
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

        let processedData: any[] = []
        let stats: any = null

        // Check if data comes from v3 (pre-aggregated: has preco_por_noite directly)
        const isPreAggregated = rawData.length > 0 && rawData[0].preco_por_noite !== undefined && rawData[0].checkin_dates !== undefined

        if (isPreAggregated) {
            // ======= V3 PRE-AGGREGATED PATH =======
            // Each row = 1 property with all data already computed in SQL
            processedData = rawData.map((item: any) => {
                const airbnbId = extractAirbnbId(item)
                const checkinData = Array.isArray(item.checkin_dates) ? item.checkin_dates : 
                    (typeof item.checkin_dates === 'string' ? JSON.parse(item.checkin_dates) : item.checkin_dates || [])
                const histData = Array.isArray(item.historico_precos) ? item.historico_precos :
                    (typeof item.historico_precos === 'string' ? JSON.parse(item.historico_precos) : item.historico_precos || [])
                
                // Build history array from checkin_dates for compatibility with frontend
                const history = checkinData.map((h: any) => ({
                    id_numerica: airbnbId,
                    data_extracao: h.extracao,
                    checkin_formatado: h.checkin,
                    preco_total: h.preco_total,
                    quantidade_noites: h.noites,
                    preco_por_noite: h.ppn,
                    url_anuncio: item.url_anuncio,
                    nome_anuncio: item.nome_anuncio,
                    tipo_propriedade: item.tipo_propriedade,
                }))
                
                return {
                    ...item,
                    id: airbnbId,
                    id_numerica: airbnbId,
                    _extracted_airbnb_id: airbnbId,
                    dist_km: item.distancia_km,
                    preco_por_noite: item.preco_por_noite || 0,
                    trend_percent: item.trend_percent || 0,
                    history,
                    historico_precos: histData.map((h: any) => ({
                        data: h.data,
                        preco: h.preco
                    }))
                }
            })

            // Stats calculation from pre-aggregated data
            if (includeStats && rawData.length > 0) {
                // Extract all checkin points from all properties
                const uniqueDailyPoints: Record<string, any> = {}

                rawData.forEach((item: any) => {
                    const listingId = extractAirbnbId(item)
                    const checkinData = Array.isArray(item.checkin_dates) ? item.checkin_dates :
                        (typeof item.checkin_dates === 'string' ? JSON.parse(item.checkin_dates) : item.checkin_dates || [])

                    checkinData.forEach((h: any) => {
                        if (!h.checkin) return
                        const date = h.checkin.toString().split('T')[0]
                        const uniqueKey = `${listingId}_${date}`
                        const extractionTime = h.extracao ? new Date(h.extracao).getTime() : 0
                        const currentPoint = uniqueDailyPoints[uniqueKey]

                        if (!currentPoint || extractionTime > currentPoint._extractionTimestamp) {
                            uniqueDailyPoints[uniqueKey] = {
                                _price: h.ppn,
                                _extractionTimestamp: extractionTime,
                                _date: date,
                                _listingId: listingId
                            }
                        }
                    })
                })

                // Aggregate by date for chart
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
        } else {
            // ======= LEGACY FLAT DATA PATH (fallback for traditional query) =======
            // Group by extracted Airbnb ID to handle duplicates
            const groups: Record<string, any[]> = {}
            rawData.forEach(item => {
                const key = extractAirbnbId(item)
                if (!groups[key]) groups[key] = []
                groups[key].push({ ...item, _extracted_airbnb_id: key })
            })

            processedData = Object.values(groups).map(group => {
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
                    id_numerica: latest._extracted_airbnb_id,
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
            if (includeStats && rawData && rawData.length > 0) {
                const uniqueDailyPoints: Record<string, any> = {}

                rawData.forEach(item => {
                    if (!item.checkin_formatado) return
                    const date = item.checkin_formatado.toString().split('T')[0]
                    const listingId = extractAirbnbId(item)
                    const uniqueKey = `${listingId}_${date}`
                    const currentPoint = uniqueDailyPoints[uniqueKey]
                    const extractionDate = item.data_extracao ? new Date(item.data_extracao).getTime() : 0

                    if (!currentPoint || extractionDate > currentPoint._extractionTimestamp) {
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
        }


        return NextResponse.json(sanitizeBigInt({
            success: true,
            data: processedData,
            stats,
            count: processedData.length,
        }))
    } catch (error) {
        console.error('[API] Error fetching competitors from Supabase:', error)

        // Provide more detailed error information
        const errorDetails: any = {
            success: false,
            error: 'Failed to fetch competitors',
            message: error instanceof Error ? error.message : String(error)
        }

        // Add Supabase-specific error details if available
        if (error && typeof error === 'object' && 'code' in error) {
            errorDetails.code = (error as any).code
            errorDetails.details = (error as any).details
            errorDetails.hint = (error as any).hint
        }

        return NextResponse.json(errorDetails, { status: 500 })
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
