import type { IntegratedData, WebhookReserva, GlobalFilters, DateFilterMode } from '@/types'

/**
 * Apply global filters to integrated data
 * Returns filtered dataset and updates reservas arrays in-place
 */
export function applyGlobalFilters(
    data: IntegratedData[],
    filters: GlobalFilters
): IntegratedData[] {
    return data
        .map(item => {
            // Deep copy to avoid in-place mutation of the original data
            let currentItem: IntegratedData = {
                ...item,
                reservas: [...item.reservas], // Clone the reservas array
                metas: [...item.metas], // Clone the metas array
                propriedade: { ...item.propriedade }, // Clone propriedade object
                metricas: { ...item.metricas } // Clone metricas object
            }

            // Property ID filter
            if (filters.propertyIds.length > 0) {
                if (!filters.propertyIds.includes(currentItem.propriedade.idpropriedade)) {
                    return null
                }
            }

            // Praça filter
            if (filters.pracas.length > 0) {
                if (!filters.pracas.includes(currentItem.propriedade.praca)) {
                    return null
                }
            }

            // Grupo filter
            if (filters.grupos.length > 0) {
                if (!filters.grupos.includes(currentItem.propriedade.grupo_nome)) {
                    return null
                }
            }

            // Sub-grupo filter
            if (filters.subGrupos.length > 0) {
                if (!filters.subGrupos.includes(currentItem.propriedade.sub_grupo)) {
                    return null
                }
            }

            // Tipo de operação filter
            if (filters.tipoOperacao.length > 0) {
                if (!filters.tipoOperacao.includes(currentItem.propriedade.empreendimento_pousada)) {
                    return null
                }
            }

            // Filter reservations by date range if specified
            if (filters.dateRange) {
                const validReservas = filterReservasByDate(
                    currentItem.reservas,
                    filters.dateRange,
                    filters.dateFilterMode
                )
                // If no reservations match date filter, exclude this property
                if (validReservas.length === 0) {
                    return null
                }
                // Update the reservas array in the copy
                currentItem.reservas = validReservas
            }

            // Filter by partnername
            if (filters.partnernames.length > 0) {
                const validReservas = currentItem.reservas.filter(r =>
                    filters.partnernames.includes(r.partnername)
                )
                if (validReservas.length === 0) {
                    return null
                }
                currentItem.reservas = validReservas
            }

            // Filter by number of guests
            if (filters.hospedes.min !== null || filters.hospedes.max !== null) {
                const validReservas = currentItem.reservas.filter(r => {
                    const matchesMin = filters.hospedes.min === null || r.guesttotalcount >= filters.hospedes.min
                    const matchesMax = filters.hospedes.max === null || r.guesttotalcount <= filters.hospedes.max
                    return matchesMin && matchesMax
                })
                if (validReservas.length === 0) {
                    return null
                }
                currentItem.reservas = validReservas
            }

            // Filter by receita (revenue)
            if (filters.receita.min !== null || filters.receita.max !== null) {
                const validReservas = currentItem.reservas.filter(r => {
                    const matchesMin = filters.receita.min === null || r.reservetotal >= filters.receita.min
                    const matchesMax = filters.receita.max === null || r.reservetotal <= filters.receita.max
                    return matchesMin && matchesMax
                })
                if (validReservas.length === 0) {
                    return null
                }
                currentItem.reservas = validReservas
            }

            // Filter by antecedência de reserva (booking lead time)
            if (filters.antecedenciaReserva.min !== null || filters.antecedenciaReserva.max !== null) {
                const validReservas = currentItem.reservas.filter(r => {
                    const matchesMin = filters.antecedenciaReserva.min === null || r.antecedencia_reserva >= filters.antecedenciaReserva.min
                    const matchesMax = filters.antecedenciaReserva.max === null || r.antecedencia_reserva <= filters.antecedenciaReserva.max
                    return matchesMin && matchesMax
                })
                if (validReservas.length === 0) {
                    return null
                }
                currentItem.reservas = validReservas
            }

            return currentItem
        })
        .filter((item): item is IntegratedData => item !== null)
        .map(item => {
            // Recalculate metrics based on filtered reservations
            return {
                ...item,
                metricas: recalculateMetrics(item.reservas, item.metas)
            }
        })
}

/**
 * Filter reservations by date range based on selected date mode
 */
function filterReservasByDate(
    reservas: WebhookReserva[],
    dateRange: { start: string; end: string },
    mode: DateFilterMode
): WebhookReserva[] {
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)

    // Set to end of day for inclusive end date
    end.setHours(23, 59, 59, 999)

    return reservas.filter(r => {
        let targetDate: Date

        switch (mode) {
            case 'checkin':
                targetDate = new Date(r.checkindate)
                break
            case 'checkout':
                targetDate = new Date(r.checkoutdate)
                break
            case 'saleDate':
                targetDate = new Date(r.creationdate)
                break
            default:
                targetDate = new Date(r.checkindate)
        }

        return targetDate >= start && targetDate <= end
    })
}

/**
 * Recalculate property metrics based on filtered reservations
 */
function recalculateMetrics(
    reservas: WebhookReserva[],
    metas: any[]
): any {
    const totalReservas = reservas.length
    const receitaTotal = reservas.reduce((sum, r) => sum + r.reservetotal, 0)
    const ticketMedio = totalReservas > 0 ? receitaTotal / totalReservas : 0
    const hospedesTotais = reservas.reduce((sum, r) => sum + r.guesttotalcount, 0)
    const diariasVendidas = reservas.reduce((sum, r) => sum + r.nightcount, 0)
    const precoMedioNoite = diariasVendidas > 0 ? receitaTotal / diariasVendidas : 0
    const antecedenciaMedia = totalReservas > 0
        ? reservas.reduce((sum, r) => sum + r.antecedencia_reserva, 0) / totalReservas
        : 0

    return {
        totalReservas,
        receitaTotal,
        ticketMedio,
        hospedesTotais,
        diariasVendidas,
        precoMedioNoite,
        antecedenciaMedia,
        metaMensal: 0, // Would need to recalculate based on metas
        metaMovel: 0,
        receitaCheckoutMes: 0,
        status: 'A' as const
    }
}

/**
 * Get unique values for filter options from data
 */
export function getFilterOptions(data: IntegratedData[]) {
    const pracas = Array.from(new Set(data.map(d => d.propriedade.praca))).sort()
    const grupos = Array.from(new Set(data.map(d => d.propriedade.grupo_nome))).sort()
    const subGrupos = Array.from(new Set(data.map(d => d.propriedade.sub_grupo))).sort()
    const tipoOperacao = Array.from(new Set(data.map(d => d.propriedade.empreendimento_pousada))).sort()

    const partnernames = Array.from(
        new Set(data.flatMap(d => d.reservas.map(r => r.partnername)))
    ).sort()

    const properties = data.map(d => ({
        id: d.propriedade.idpropriedade,
        name: d.propriedade.nomepropriedade
    })).sort((a, b) => a.name.localeCompare(b.name))

    return {
        pracas,
        grupos,
        subGrupos,
        tipoOperacao,
        partnernames,
        properties
    }
}

/**
 * Get date range presets
 */
export function getDatePresets() {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()

    return {
        last7Days: {
            start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end: today.toISOString().split('T')[0]
        },
        last30Days: {
            start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end: today.toISOString().split('T')[0]
        },
        thisMonth: {
            start: new Date(currentYear, currentMonth, 1).toISOString().split('T')[0],
            end: new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]
        },
        lastMonth: {
            start: new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0],
            end: new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]
        },
        thisQuarter: {
            start: new Date(currentYear, Math.floor(currentMonth / 3) * 3, 1).toISOString().split('T')[0],
            end: new Date(currentYear, Math.floor(currentMonth / 3) * 3 + 3, 0).toISOString().split('T')[0]
        },
        thisYear: {
            start: new Date(currentYear, 0, 1).toISOString().split('T')[0],
            end: new Date(currentYear, 11, 31).toISOString().split('T')[0]
        }
    }
}
