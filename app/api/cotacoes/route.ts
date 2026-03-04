/**
 * API Route: /api/cotacoes
 * 
 * Fetches cotações from Supabase and performs intelligent matching
 * with BigQuery reservations to calculate conversion metrics.
 */

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { executeQuery } from '@/lib/bigquery-client'
import { normalizePhone, parseBrazilianDate, normalizeDestino } from '@/lib/phone-utils'
import { serverCache, CACHE_KEYS } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DIRECT_CHANNELS = [
    'Website',
    'Atendimento',
    'Atendimento Host',
    'Atendimento Curta Bora',
]

interface CotacaoRaw {
    id: string
    chat_id: number
    check_in: string | null
    check_out: string | null
    hospedes: number | null
    destino: string | null
    cliente: string | null
    telefone: string | null
    'vendeu?': boolean | null
    data_venda: string | null
    motivo_de_nao_venda: string | null
    data_cotacao: string
    idreserva: string | null
    canal: string | null
}

interface ReservaBQ {
    phoneNumber: string
    firstName: string
    lastName: string
    partnerName: string
    creationDate: string
    checkInDate: string
    checkOutDate: string
    reserveTotal: number
    idPropriedade: string
    nomePropriedade: string
    idReserva: string
}

function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getTimeSlot(dateStr: string): 'Manhã' | 'Tarde' | 'Noite' {
    const d = new Date(dateStr)
    const hour = d.getHours()
    if (hour < 12) return 'Manhã'
    if (hour < 18) return 'Tarde'
    return 'Noite'
}

function getDayOfWeekPt(date: Date): string {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    return days[date.getDay()]
}

export async function GET() {
    const startTime = Date.now()

    try {
        const cachedResult = serverCache.get<any>(CACHE_KEYS.COTACOES)
        if (cachedResult) {
            return NextResponse.json({
                ...cachedResult,
                fetchTime: 0,
                cached: true,
                timestamp: new Date().toISOString(),
            })
        }

        const supabase = getSupabaseAdmin()
        if (!supabase) {
            return NextResponse.json(
                { success: false, error: 'Supabase not configured' },
                { status: 500 }
            )
        }

        const { data: cotacoes, error: cotacoesError } = await supabase
            .from('cotacoes_huggy')
            .select('*')
            .order('data_cotacao', { ascending: false })

        if (cotacoesError) {
            console.error('[Cotações] Supabase error:', cotacoesError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch cotações', details: cotacoesError.message },
                { status: 500 }
            )
        }

        const channelList = DIRECT_CHANNELS.map(c => `'${c}'`).join(', ')
        const reservasQuery = `
            SELECT 
                phoneNumber,
                firstName,
                lastName,
                partnerName,
                creationDate,
                checkInDate,
                checkOutDate,
                reserveTotal,
                idPropriedade,
                nomePropriedade,
                idReserva
            FROM \`qavi-425611.warehouse.reservas\`
            WHERE partnerName IN (${channelList})
            AND phoneNumber IS NOT NULL 
            AND phoneNumber != ''
        `

        let reservas: ReservaBQ[] = []
        try {
            reservas = await executeQuery<ReservaBQ>(reservasQuery)
        } catch (bqError) {
            console.error('[Cotações] BigQuery error:', bqError)
        }

        const phoneToReservas = new Map<string, ReservaBQ[]>()
        for (const r of reservas) {
            const normalized = normalizePhone(r.phoneNumber)
            if (normalized) {
                const existing = phoneToReservas.get(normalized) || []
                existing.push(r)
                phoneToReservas.set(normalized, existing)
            }
        }

        // Process cotações
        const processedCotacoes = (cotacoes as CotacaoRaw[]).map(cot => {
            const normalizedPhone = normalizePhone(cot.telefone)
            const parsedCheckIn = parseBrazilianDate(cot.check_in)
            const parsedCheckOut = parseBrazilianDate(cot.check_out)
            const pracaNormalized = normalizeDestino(cot.destino)

            let matchedReserva: ReservaBQ | null = null
            let conversionType: 'converted' | 'none' = 'none'

            if (normalizedPhone && phoneToReservas.has(normalizedPhone)) {
                const matchingReservas = phoneToReservas.get(normalizedPhone)!
                const cotDate = new Date(cot.data_cotacao)
                const candidates = matchingReservas.filter(r => {
                    const parts = r.creationDate.split('-')
                    if (parts.length === 3) {
                        const resDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
                        const diffDays = (resDate.getTime() - cotDate.getTime()) / (1000 * 60 * 60 * 24)
                        return diffDays >= -1 && diffDays <= 30
                    }
                    return false
                })

                if (candidates.length > 0) {
                    matchedReserva = candidates.sort((a, b) => {
                        const aParts = a.creationDate.split('-')
                        const bParts = b.creationDate.split('-')
                        const aDate = new Date(`${aParts[2]}-${aParts[1]}-${aParts[0]}`)
                        const bDate = new Date(`${bParts[2]}-${bParts[1]}-${bParts[0]}`)
                        return Math.abs(aDate.getTime() - cotDate.getTime()) - Math.abs(bDate.getTime() - cotDate.getTime())
                    })[0]
                    conversionType = 'converted'
                }
            }

            let nightsRequested: number | null = null
            if (parsedCheckIn && parsedCheckOut) {
                const diffMs = new Date(parsedCheckOut).getTime() - new Date(parsedCheckIn).getTime()
                nightsRequested = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)))
            }

            let leadTimeDays: number | null = null
            if (parsedCheckIn) {
                const diffMs = new Date(parsedCheckIn).getTime() - new Date(cot.data_cotacao).getTime()
                leadTimeDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)))
            }

            let normalizedCanal = cot.canal || 'Não identificado'
            if (normalizedCanal === 'WhatsApp' || normalizedCanal === 'Whatsapp') {
                normalizedCanal = 'WhatsApp'
            }

            // Time slot & day of week from cotação timestamp
            const cotDate = new Date(cot.data_cotacao)
            const timeSlot = getTimeSlot(cot.data_cotacao)
            const dayOfWeek = getDayOfWeekPt(cotDate)
            const dayOfWeekNum = cotDate.getDay()

            // Check-in week (ISO week)
            let checkInWeek: number | null = null
            let checkInYear: number | null = null
            if (parsedCheckIn) {
                const ciDate = new Date(parsedCheckIn)
                checkInWeek = getISOWeek(ciDate)
                checkInYear = ciDate.getFullYear()
            }

            return {
                id: cot.id,
                chatId: cot.chat_id,
                cliente: cot.cliente,
                telefone: cot.telefone,
                phoneNormalized: normalizedPhone,
                canal: normalizedCanal,
                destino: cot.destino,
                pracaNormalized,
                checkIn: parsedCheckIn,
                checkOut: parsedCheckOut,
                checkInRaw: cot.check_in,
                checkOutRaw: cot.check_out,
                datesParseable: !!(parsedCheckIn && parsedCheckOut),
                hospedes: cot.hospedes ? Number(cot.hospedes) : null,
                nightsRequested,
                leadTimeDays,
                dataCotacao: cot.data_cotacao,
                idreserva: cot.idreserva,
                conversionType,
                timeSlot,
                dayOfWeek,
                dayOfWeekNum,
                checkInWeek,
                checkInYear,
                matchedReserva: matchedReserva ? {
                    idReserva: matchedReserva.idReserva,
                    propertyName: matchedReserva.nomePropriedade,
                    partnerName: matchedReserva.partnerName,
                    reserveTotal: matchedReserva.reserveTotal || 0,
                    creationDate: matchedReserva.creationDate,
                    checkIn: matchedReserva.checkInDate,
                    checkOut: matchedReserva.checkOutDate,
                } : null,
            }
        })

        // ─── ANALYTICS ──────────────────────────────────────────
        const today = new Date().toISOString().split('T')[0]
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

        const totalCotacoes = processedCotacoes.length
        const cotacoesHoje = processedCotacoes.filter(c => c.dataCotacao.split('T')[0].startsWith(today)).length
        const cotacoesOntem = processedCotacoes.filter(c => c.dataCotacao.split('T')[0].startsWith(yesterday)).length
        const cotacoes30d = processedCotacoes.filter(c => c.dataCotacao >= thirtyDaysAgo).length

        const converted = processedCotacoes.filter(c => c.conversionType === 'converted')
        const conversionRate = totalCotacoes > 0 ? (converted.length / totalCotacoes) * 100 : 0

        const matchedRevenue = converted.reduce((sum, c) => sum + (c.matchedReserva?.reserveTotal || 0), 0)

        // By destino
        const byDestino: Record<string, { total: number; converted: number; revenue: number }> = {}
        for (const c of processedCotacoes) {
            const key = c.pracaNormalized
            if (!byDestino[key]) byDestino[key] = { total: 0, converted: 0, revenue: 0 }
            byDestino[key].total++
            if (c.conversionType === 'converted') {
                byDestino[key].converted++
                byDestino[key].revenue += c.matchedReserva?.reserveTotal || 0
            }
        }

        // By canal
        const byCanal: Record<string, { total: number; converted: number }> = {}
        for (const c of processedCotacoes) {
            const key = c.canal
            if (!byCanal[key]) byCanal[key] = { total: 0, converted: 0 }
            byCanal[key].total++
            if (c.conversionType === 'converted') byCanal[key].converted++
        }

        // By partner (canal de venda que converteu)
        const byPartner: Record<string, { total: number; revenue: number }> = {}
        for (const c of converted) {
            if (c.matchedReserva) {
                const key = c.matchedReserva.partnerName
                if (!byPartner[key]) byPartner[key] = { total: 0, revenue: 0 }
                byPartner[key].total++
                byPartner[key].revenue += c.matchedReserva.reserveTotal || 0
            }
        }

        // Daily volume (last 30 days)
        const dailyVolume: Record<string, { cotacoes: number; converted: number }> = {}
        for (const c of processedCotacoes) {
            const day = c.dataCotacao.split('T')[0]
            if (day >= thirtyDaysAgo) {
                if (!dailyVolume[day]) dailyVolume[day] = { cotacoes: 0, converted: 0 }
                dailyVolume[day].cotacoes++
                if (c.conversionType === 'converted') dailyVolume[day].converted++
            }
        }

        // Check-in month distribution
        const byCheckInMonth: Record<string, number> = {}
        for (const c of processedCotacoes) {
            if (c.checkIn) {
                const monthKey = c.checkIn.substring(0, 7)
                byCheckInMonth[monthKey] = (byCheckInMonth[monthKey] || 0) + 1
            }
        }

        // Check-in weekly distribution (item 8)
        const byCheckInWeek: Record<string, { week: number; year: number; count: number; destinos: Record<string, number> }> = {}
        for (const c of processedCotacoes) {
            if (c.checkInWeek && c.checkInYear) {
                const key = `${c.checkInYear}-W${String(c.checkInWeek).padStart(2, '0')}`
                if (!byCheckInWeek[key]) {
                    byCheckInWeek[key] = { week: c.checkInWeek, year: c.checkInYear, count: 0, destinos: {} }
                }
                byCheckInWeek[key].count++
                const dest = c.pracaNormalized
                byCheckInWeek[key].destinos[dest] = (byCheckInWeek[key].destinos[dest] || 0) + 1
            }
        }

        // Day of week × time slot heatmap (item 6)
        const dayTimeHeatmap: Record<string, number> = {}
        const byDayOfWeek: Record<string, number> = {}
        const byTimeSlot: Record<string, number> = {}
        for (const c of processedCotacoes) {
            const key = `${c.dayOfWeekNum}-${c.timeSlot}`
            dayTimeHeatmap[key] = (dayTimeHeatmap[key] || 0) + 1
            byDayOfWeek[c.dayOfWeek] = (byDayOfWeek[c.dayOfWeek] || 0) + 1
            byTimeSlot[c.timeSlot] = (byTimeSlot[c.timeSlot] || 0) + 1
        }

        // Build heatmap array for chart
        const dayOrder = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
        const dayNumMap: Record<string, number> = { 'Dom': 0, 'Seg': 1, 'Ter': 2, 'Qua': 3, 'Qui': 4, 'Sex': 5, 'Sáb': 6 }
        const timeSlots = ['Manhã', 'Tarde', 'Noite'] as const
        const heatmapData = dayOrder.map(day => {
            const dayNum = dayNumMap[day]
            const result: Record<string, number | string> = { day }
            for (const slot of timeSlots) {
                result[slot] = dayTimeHeatmap[`${dayNum}-${slot}`] || 0
            }
            result.total = (result['Manhã'] as number) + (result['Tarde'] as number) + (result['Noite'] as number)
            return result
        })

        // Lead time
        const leadTimes = processedCotacoes
            .filter(c => c.leadTimeDays !== null && c.leadTimeDays >= 0 && c.leadTimeDays < 365)
            .map(c => c.leadTimeDays!)
        const avgLeadTime = leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : 0

        // Hot cotações
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600000).toISOString()
        const hotCotacoes = processedCotacoes.filter(c =>
            c.conversionType === 'none' &&
            c.dataCotacao >= fortyEightHoursAgo
        ).length

        const parseableRate = totalCotacoes > 0
            ? (processedCotacoes.filter(c => c.datesParseable).length / totalCotacoes) * 100
            : 0

        const hospedesValues = processedCotacoes.filter(c => c.hospedes && c.hospedes > 0).map(c => c.hospedes!)
        const avgHospedes = hospedesValues.length > 0
            ? hospedesValues.reduce((a, b) => a + b, 0) / hospedesValues.length
            : 0

        // Unique filter values for frontend filters
        const uniqueCanais = [...new Set(processedCotacoes.map(c => c.canal))].sort()
        const uniqueDestinos = [...new Set(processedCotacoes.map(c => c.pracaNormalized))].sort()

        const analytics = {
            overview: {
                totalCotacoes,
                cotacoesHoje,
                cotacoesOntem,
                cotacoes30d,
                avgCotacoesDia: cotacoes30d > 0 ? cotacoes30d / 30 : 0,
            },
            conversion: {
                totalConverted: converted.length,
                matchedCount: converted.length,
                conversionRateTotal: conversionRate,
                matchedRevenue,
            },
            demand: {
                byDestino: Object.entries(byDestino)
                    .map(([name, data]) => ({
                        name,
                        ...data,
                        conversionRate: data.total > 0 ? (data.converted / data.total * 100) : 0,
                    }))
                    .sort((a, b) => b.total - a.total),
                byCanal: Object.entries(byCanal)
                    .map(([name, data]) => ({
                        name,
                        ...data,
                        conversionRate: data.total > 0 ? (data.converted / data.total * 100) : 0,
                    }))
                    .sort((a, b) => b.total - a.total),
                byPartner: Object.entries(byPartner)
                    .map(([name, data]) => ({ name, ...data }))
                    .sort((a, b) => b.total - a.total),
                byCheckInMonth: Object.entries(byCheckInMonth)
                    .map(([month, count]) => ({ month, count }))
                    .sort((a, b) => a.month.localeCompare(b.month)),
                byCheckInWeek: Object.entries(byCheckInWeek)
                    .map(([key, data]) => ({
                        key,
                        ...data,
                        topDestinos: Object.entries(data.destinos)
                            .map(([name, cnt]) => ({ name, count: cnt }))
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 5),
                    }))
                    .sort((a, b) => a.key.localeCompare(b.key)),
            },
            behavior: {
                avgLeadTimeDays: avgLeadTime,
                avgHospedes,
                parseableRate,
                hotCotacoes,
                dailyVolume: Object.entries(dailyVolume)
                    .map(([date, data]) => ({ date, ...data }))
                    .sort((a, b) => a.date.localeCompare(b.date)),
                heatmapData,
            },
            filters: {
                canais: uniqueCanais,
                destinos: uniqueDestinos,
            },
        }

        const responseData = {
            success: true,
            cotacoes: processedCotacoes,
            analytics,
            matchInfo: {
                totalReservasSearched: reservas.length,
                totalPhonesInCotacoes: processedCotacoes.filter(c => c.phoneNormalized).length,
                totalPhonesInReservas: phoneToReservas.size,
                matchesFound: converted.length,
            },
        }

        serverCache.set(CACHE_KEYS.COTACOES, responseData, 300)

        return NextResponse.json({
            ...responseData,
            fetchTime: Date.now() - startTime,
            cached: false,
            timestamp: new Date().toISOString(),
        })

    } catch (error) {
        console.error('[Cotações API] Error:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to process cotações data',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}
