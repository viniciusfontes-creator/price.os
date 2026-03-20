/**
 * Utilit��rios para análise de peer group (propriedades similares)
 *
 * Funções para matching de propriedades similares e cálculo de KPIs comparativos
 */

import { IntegratedData } from '@/types'
import { addMonths, startOfMonth, endOfMonth, differenceInDays, parseISO } from 'date-fns'

export interface PeerGroupCriteria {
    /** Praça (localização) */
    praca?: string
    /** Diferença máxima de quartos permitida (±) */
    roomsTolerance?: number
    /** Diferença máxima de hóspedes permitida (±) */
    guestsTolerance?: number
    /** Incluir propriedade atual no grupo */
    includeSelf?: boolean
}

export interface PeerGroupKPIs {
    /** Average Daily Rate - Tarifa Diária Média */
    adr: number
    /** Taxa de Ocupação (%) */
    occupancyRate: number
    /** Tempo RAC - Reserva até Checkout (dias) */
    avgRAC: number
    /** Faturamento Realizado */
    totalRevenue: number
    /** Número de propriedades no peer group */
    propertyCount: number
    /** Número total de reservas */
    reservationCount: number
}

export interface Reservation {
    idReserva?: string  // BigQuery field name
    idpropriedade: string
    nomepropriedade: string
    hospede?: string
    checkindate: string | Date  // BigQuery field name
    checkoutdate: string | Date  // BigQuery field name
    reservetotal?: number
    nightcount?: number  // BigQuery field name
    creationdate?: string | Date  // BigQuery field name
    [key: string]: any
}

/**
 * Encontra propriedades similares (peer group) baseado em critérios
 */
export function findPeerGroup(
    currentProperty: IntegratedData,
    allProperties: IntegratedData[],
    criteria: PeerGroupCriteria = {}
): IntegratedData[] {
    const {
        praca = currentProperty.propriedade.praca,
        roomsTolerance = 1,
        guestsTolerance = 2,
        includeSelf = false
    } = criteria

    const currentRooms = Number(currentProperty.propriedade._i_rooms) || 0
    const currentGuests = Number(currentProperty.propriedade._i_maxguests) || 0

    return allProperties.filter(property => {
        // Excluir propriedade atual se necessário
        if (!includeSelf && property.propriedade.idpropriedade === currentProperty.propriedade.idpropriedade) {
            return false
        }

        // Match por praça
        if (praca && property.propriedade.praca !== praca) {
            return false
        }

        // Match por quartos (com tolerância)
        const propertyRooms = Number(property.propriedade._i_rooms) || 0
        if (Math.abs(propertyRooms - currentRooms) > roomsTolerance) {
            return false
        }

        // Match por hóspedes (com tolerância)
        const propertyGuests = Number(property.propriedade._i_maxguests) || 0
        if (Math.abs(propertyGuests - currentGuests) > guestsTolerance) {
            return false
        }

        return true
    })
}

/**
 * Calcula KPIs agregados para um peer group em um período específico
 */
export function calculatePeerGroupKPIs(
    peerGroup: IntegratedData[],
    yearMonth: string // Format: 'YYYY-MM'
): PeerGroupKPIs {
    const monthStart = startOfMonth(new Date(yearMonth + '-01'))
    const monthEnd = endOfMonth(monthStart)

    let totalRevenue = 0
    let totalNights = 0
    let totalRACDays = 0
    let reservationCount = 0
    let occupiedDays = 0
    const totalDaysInMonth = differenceInDays(monthEnd, monthStart) + 1
    const totalPossibleDays = peerGroup.length * totalDaysInMonth

    peerGroup.forEach(property => {
        // Filter reservations for the month
        const monthReservations = property.reservas?.filter((reserva: any) => {
            const checkout = typeof reserva.checkoutdate === 'string' ? parseISO(reserva.checkoutdate) : new Date(reserva.checkoutdate)
            return checkout >= monthStart && checkout <= monthEnd
        }) || []

        monthReservations.forEach((reserva: any) => {
            const reserveTotal = parseFloat(reserva.reservetotal?.toString() || '0')
            const nights = parseInt(reserva.nightcount?.toString() || '0')

            // Revenue
            totalRevenue += reserveTotal

            // Nights for ADR calculation
            if (nights > 0) {
                totalNights += nights
            }

            // RAC calculation (Reservation to Checkout time)
            if (reserva.creationdate && reserva.checkoutdate) {
                const creationDate = typeof reserva.creationdate === 'string'
                    ? parseISO(reserva.creationdate)
                    : new Date(reserva.creationdate)
                const checkoutDate = typeof reserva.checkoutdate === 'string'
                    ? parseISO(reserva.checkoutdate)
                    : new Date(reserva.checkoutdate)

                const racDays = differenceInDays(checkoutDate, creationDate)
                if (racDays > 0) {
                    totalRACDays += racDays
                    reservationCount++
                }
            }
        })

        // Occupancy calculation
        property.ocupacao?.forEach((occ: any) => {
            // Field in OcupacaoDisponibilidade is 'datas' not 'dia'
            const dateStr = (occ as any).datas || (occ as any).dia
            if (!dateStr) return

            const occDate = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr)
            if (occDate >= monthStart && occDate <= monthEnd) {
                // Field in OcupacaoDisponibilidade is 'ocupado' (1/0)
                if (occ.ocupado === 1 || (occ as any).status === 'ocupado') {
                    occupiedDays++
                }
            }
        })
    })

    return {
        adr: totalNights > 0 ? totalRevenue / totalNights : 0,
        occupancyRate: totalPossibleDays > 0 ? (occupiedDays / totalPossibleDays) * 100 : 0,
        avgRAC: reservationCount > 0 ? totalRACDays / reservationCount : 0,
        totalRevenue,
        propertyCount: peerGroup.length,
        reservationCount
    }
}

/**
 * Retorna todas as reservas de um peer group para um mês específico (para drill-down)
 */
export function getPeerGroupReservations(
    peerGroup: IntegratedData[],
    yearMonth: string // Format: 'YYYY-MM'
): Reservation[] {
    const monthStart = startOfMonth(new Date(yearMonth + '-01'))
    const monthEnd = endOfMonth(monthStart)

    const allReservations: Reservation[] = []

    peerGroup.forEach(property => {
        const monthReservations = property.reservas?.filter((reserva: any) => {
            const checkout = typeof reserva.checkoutdate === 'string' ? parseISO(reserva.checkoutdate) : new Date(reserva.checkoutdate)
            return checkout >= monthStart && checkout <= monthEnd
        }) || []

        // Add property name to each reservation for display
        monthReservations.forEach((reserva: any) => {
            allReservations.push({
                ...reserva,
                nomepropriedade: property.propriedade.nomepropriedade
            })
        })
    })

    // Sort by checkout date descending
    return allReservations.sort((a, b) => {
        const dateA = typeof a.checkoutdate === 'string' ? parseISO(a.checkoutdate) : new Date(a.checkoutdate)
        const dateB = typeof b.checkoutdate === 'string' ? parseISO(b.checkoutdate) : new Date(b.checkoutdate)
        return dateB.getTime() - dateA.getTime()
    })
}

/**
 * Compara KPIs de uma propriedade específica com o peer group
 */
export function compareToPeerGroup(
    currentProperty: IntegratedData,
    peerGroupKPIs: PeerGroupKPIs,
    yearMonth: string
): {
    currentKPIs: PeerGroupKPIs
    deltas: {
        adr: number
        occupancyRate: number
        avgRAC: number
        totalRevenue: number
    }
} {
    const currentKPIs = calculatePeerGroupKPIs([currentProperty], yearMonth)

    return {
        currentKPIs,
        deltas: {
            adr: currentKPIs.adr - peerGroupKPIs.adr,
            occupancyRate: currentKPIs.occupancyRate - peerGroupKPIs.occupancyRate,
            avgRAC: currentKPIs.avgRAC - peerGroupKPIs.avgRAC,
            totalRevenue: currentKPIs.totalRevenue - (peerGroupKPIs.totalRevenue / peerGroupKPIs.propertyCount)
        }
    }
}

/**
 * Formata valores monetários (BRL)
 */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value)
}

/**
 * Formata percentuais
 */
export function formatPercentage(value: number, decimals: number = 1): string {
    return `${value.toFixed(decimals)}%`
}

/**
 * Formata delta com sinal (+/-)
 */
export function formatDelta(value: number, formatter: (v: number) => string): string {
    const sign = value > 0 ? '+' : ''
    return sign + formatter(Math.abs(value))
}
