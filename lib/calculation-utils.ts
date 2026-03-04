import type { IntegratedData, GlobalFilters } from '@/types'
import { applyGlobalFilters } from './filter-utils'

/**
 * Calculate total revenue from filtered data
 */
export function calculateTotalRevenue(
    data: IntegratedData[],
    filters?: GlobalFilters
): number {
    const filteredData = filters ? applyGlobalFilters(data, filters) : data

    return filteredData.reduce((total, item) => {
        return total + item.reservas.reduce((sum, r) => sum + r.reservetotal, 0)
    }, 0)
}

/**
 * Calculate total reservations count from filtered data
 */
export function calculateTotalReservations(
    data: IntegratedData[],
    filters?: GlobalFilters
): number {
    const filteredData = filters ? applyGlobalFilters(data, filters) : data

    return filteredData.reduce((total, item) => {
        return total + item.reservas.length
    }, 0)
}

/**
 * Calculate average ticket (revenue per reservation)
 */
export function calculateAverageTicket(
    data: IntegratedData[],
    filters?: GlobalFilters
): number {
    const revenue = calculateTotalRevenue(data, filters)
    const reservations = calculateTotalReservations(data, filters)

    return reservations > 0 ? revenue / reservations : 0
}

/**
 * Calculate total nights sold
 */
export function calculateTotalNights(
    data: IntegratedData[],
    filters?: GlobalFilters
): number {
    const filteredData = filters ? applyGlobalFilters(data, filters) : data

    return filteredData.reduce((total, item) => {
        return total + item.reservas.reduce((sum, r) => sum + r.nightcount, 0)
    }, 0)
}

/**
 * Calculate average daily rate (ADR)
 */
export function calculateADR(
    data: IntegratedData[],
    filters?: GlobalFilters
): number {
    const revenue = calculateTotalRevenue(data, filters)
    const nights = calculateTotalNights(data, filters)

    return nights > 0 ? revenue / nights : 0
}

/**
 * Calculate total guests
 */
export function calculateTotalGuests(
    data: IntegratedData[],
    filters?: GlobalFilters
): number {
    const filteredData = filters ? applyGlobalFilters(data, filters) : data

    return filteredData.reduce((total, item) => {
        return total + item.reservas.reduce((sum, r) => sum + r.guesttotalcount, 0)
    }, 0)
}

/**
 * Calculate occupancy rate for a date range
 */
export function calculateOccupancyRate(
    data: IntegratedData[],
    startDate: string,
    endDate: string,
    filters?: GlobalFilters
): number {
    const filteredData = filters ? applyGlobalFilters(data, filters) : data

    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    if (days <= 0 || filteredData.length === 0) return 0

    let occupiedNights = 0

    // Pre-compute occupied date sets per property to avoid O(days * properties * reservations)
    filteredData.forEach((item) => {
        const occupiedDates = new Set<string>()
        item.reservas.forEach((r) => {
            const checkin = new Date(r.checkindate)
            const checkout = new Date(r.checkoutdate)
            for (let d = new Date(Math.max(checkin.getTime(), start.getTime()));
                 d < checkout && d < end;
                 d.setDate(d.getDate() + 1)) {
                occupiedDates.add(d.toISOString().split('T')[0])
            }
        })
        occupiedNights += occupiedDates.size
    })

    const totalAvailableNights = filteredData.length * days
    return totalAvailableNights > 0 ? (occupiedNights / totalAvailableNights) * 100 : 0
}

/**
 * Calculate revenue by channel/partner
 */
export function calculateRevenueByPartner(
    data: IntegratedData[],
    filters?: GlobalFilters
): { partner: string; revenue: number; count: number; percentage: number }[] {
    const filteredData = filters ? applyGlobalFilters(data, filters) : data

    const partnerStats = new Map<string, { revenue: number; count: number }>()
    let totalRevenue = 0

    filteredData.forEach((item) => {
        item.reservas.forEach((reserva) => {
            const partner = reserva.partnername
            if (!partnerStats.has(partner)) {
                partnerStats.set(partner, { revenue: 0, count: 0 })
            }
            const stats = partnerStats.get(partner)!
            stats.revenue += reserva.reservetotal
            stats.count++
            totalRevenue += reserva.reservetotal
        })
    })

    return Array.from(partnerStats.entries())
        .map(([partner, stats]) => ({
            partner,
            revenue: stats.revenue,
            count: stats.count,
            percentage: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
}

/**
 * Calculate goal achievement percentage
 */
export function calculateGoalAchievement(
    data: IntegratedData[],
    filters?: GlobalFilters
): { achieved: number; goal: number; percentage: number } {
    const filteredData = filters ? applyGlobalFilters(data, filters) : data

    const achieved = calculateTotalRevenue(filteredData)
    const goal = filteredData.reduce((total, item) => total + item.metricas.metaMensal, 0)

    return {
        achieved,
        goal,
        percentage: goal > 0 ? (achieved / goal) * 100 : 0,
    }
}

/**
 * Calculate average booking lead time
 */
export function calculateAverageLeadTime(
    data: IntegratedData[],
    filters?: GlobalFilters
): number {
    const filteredData = filters ? applyGlobalFilters(data, filters) : data

    let totalLeadTime = 0
    let count = 0

    filteredData.forEach((item) => {
        item.reservas.forEach((reserva) => {
            totalLeadTime += reserva.antecedencia_reserva
            count++
        })
    })

    return count > 0 ? totalLeadTime / count : 0
}

/**
 * Get top performing properties by revenue
 */
export function getTopProperties(
    data: IntegratedData[],
    limit: number = 10,
    filters?: GlobalFilters
): Array<{
    id: string
    name: string
    revenue: number
    reservations: number
    averageTicket: number
}> {
    const filteredData = filters ? applyGlobalFilters(data, filters) : data

    return filteredData
        .map((item) => {
            const revenue = item.reservas.reduce((sum, r) => sum + r.reservetotal, 0)
            const reservations = item.reservas.length

            return {
                id: item.propriedade.idpropriedade,
                name: item.propriedade.nomepropriedade,
                revenue,
                reservations,
                averageTicket: reservations > 0 ? revenue / reservations : 0,
            }
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit)
}

/**
 * Calculate conversion funnel metrics
 */
export function calculateConversionMetrics(
    data: IntegratedData[],
    filters?: GlobalFilters
): {
    totalProperties: number
    propertiesWithSales: number
    conversionRate: number
    averageSalesPerProperty: number
} {
    const filteredData = filters ? applyGlobalFilters(data, filters) : data

    const totalProperties = filteredData.length
    const propertiesWithSales = filteredData.filter((item) => item.reservas.length > 0).length
    const totalSales = calculateTotalReservations(filteredData)

    return {
        totalProperties,
        propertiesWithSales,
        conversionRate: totalProperties > 0 ? (propertiesWithSales / totalProperties) * 100 : 0,
        averageSalesPerProperty: totalProperties > 0 ? totalSales / totalProperties : 0,
    }
}

/**
 * Handle edge cases for empty filtered results
 */
export function hasValidData(data: IntegratedData[], filters?: GlobalFilters): boolean {
    const filteredData = filters ? applyGlobalFilters(data, filters) : data
    return filteredData.length > 0
}

/**
 * Get safe metrics with fallback for empty results
 */
export function getSafeMetrics(
    data: IntegratedData[],
    filters?: GlobalFilters
): {
    revenue: number
    reservations: number
    averageTicket: number
    adr: number
    nights: number
    hasData: boolean
} {
    const hasData = hasValidData(data, filters)

    if (!hasData) {
        return {
            revenue: 0,
            reservations: 0,
            averageTicket: 0,
            adr: 0,
            nights: 0,
            hasData: false,
        }
    }

    return {
        revenue: calculateTotalRevenue(data, filters),
        reservations: calculateTotalReservations(data, filters),
        averageTicket: calculateAverageTicket(data, filters),
        adr: calculateADR(data, filters),
        nights: calculateTotalNights(data, filters),
        hasData: true,
    }
}
