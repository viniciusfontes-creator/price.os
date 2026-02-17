import { describe, it, expect } from '@jest/globals'
import {
    calculateTotalRevenue,
    calculateTotalReservations,
    calculateAverageTicket,
    calculateTotalNights,
    calculateADR,
    calculateTotalGuests,
    calculateOccupancyRate,
    calculateRevenueByPartner,
    calculateGoalAchievement,
    calculateAverageLeadTime,
    getTopProperties,
    calculateConversionMetrics,
    hasValidData,
    getSafeMetrics,
} from '@/lib/calculation-utils'
import { DEFAULT_FILTERS } from '@/types'
import type { IntegratedData, GlobalFilters } from '@/types'

// Mock data
const mockData: IntegratedData[] = [
    {
        propriedade: {
            idpropriedade: '1',
            nomepropriedade: 'Casa São Paulo',
            grupo_nome: 'Grupo A',
            praca: 'São Paulo',
            empreendimento_pousada: 'short stay',
            sub_grupo: 'Premium',
        },
        reservas: [
            {
                idpropriedade: '1',
                companycommision: 100,
                buyprice: 500,
                reservetotal: 1000,
                checkoutdate: '2026-01-15',
                creationdate: '2026-01-01',
                checkindate: '2026-01-10',
                antecedencia_reserva: 9,
                guesttotalcount: 2,
                nightcount: 5,
                pricepernight: 200,
                partnername: 'Airbnb',
                agentname: 'Agent 1',
            },
            {
                idpropriedade: '1',
                companycommision: 150,
                buyprice: 750,
                reservetotal: 1500,
                checkoutdate: '2026-01-25',
                creationdate: '2026-01-05',
                checkindate: '2026-01-20',
                antecedencia_reserva: 15,
                guesttotalcount: 4,
                nightcount: 5,
                pricepernight: 300,
                partnername: 'Booking',
                agentname: 'Agent 2',
            },
        ],
        metas: [
            {
                IdPropriedade: '1',
                data_especifica: '2026-01-01',
                meta: 5000,
                meta_movel: 4500,
            },
        ],
        metricas: {
            totalReservas: 2,
            receitaTotal: 2500,
            ticketMedio: 1250,
            hospedesTotais: 6,
            diariasVendidas: 10,
            precoMedioNoite: 250,
            antecedenciaMedia: 12,
            metaMensal: 5000,
            metaMovel: 4500,
            receitaCheckoutMes: 2500,
            status: 'B',
        },
    },
    {
        propriedade: {
            idpropriedade: '2',
            nomepropriedade: 'Apartamento Rio',
            grupo_nome: 'Grupo B',
            praca: 'Rio de Janeiro',
            empreendimento_pousada: 'long stay',
            sub_grupo: 'Standard',
        },
        reservas: [
            {
                idpropriedade: '2',
                companycommision: 200,
                buyprice: 1000,
                reservetotal: 2000,
                checkoutdate: '2026-02-15',
                creationdate: '2026-01-10',
                checkindate: '2026-02-01',
                antecedencia_reserva: 22,
                guesttotalcount: 3,
                nightcount: 14,
                pricepernight: 142.86,
                partnername: 'Airbnb',
                agentname: 'Agent 3',
            },
        ],
        metas: [
            {
                IdPropriedade: '2',
                data_especifica: '2026-01-01',
                meta: 3000,
                meta_movel: 2800,
            },
        ],
        metricas: {
            totalReservas: 1,
            receitaTotal: 2000,
            ticketMedio: 2000,
            hospedesTotais: 3,
            diariasVendidas: 14,
            precoMedioNoite: 142.86,
            antecedenciaMedia: 22,
            metaMensal: 3000,
            metaMovel: 2800,
            receitaCheckoutMes: 0,
            status: 'C',
        },
    },
]

describe('Calculation Utils', () => {
    describe('calculateTotalRevenue', () => {
        it('should calculate total revenue without filters', () => {
            const revenue = calculateTotalRevenue(mockData)
            expect(revenue).toBe(4500) // 1000 + 1500 + 2000
        })

        it('should calculate total revenue with filters', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                pracas: ['São Paulo'],
            }
            const revenue = calculateTotalRevenue(mockData, filters)
            expect(revenue).toBe(2500) // Only São Paulo
        })

        it('should return 0 for empty data', () => {
            const revenue = calculateTotalRevenue([])
            expect(revenue).toBe(0)
        })
    })

    describe('calculateTotalReservations', () => {
        it('should count total reservations', () => {
            const count = calculateTotalReservations(mockData)
            expect(count).toBe(3)
        })

        it('should count filtered reservations', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                partnernames: ['Airbnb'],
            }
            const count = calculateTotalReservations(mockData, filters)
            expect(count).toBe(2) // 2 Airbnb reservations
        })
    })

    describe('calculateAverageTicket', () => {
        it('should calculate average ticket', () => {
            const avgTicket = calculateAverageTicket(mockData)
            expect(avgTicket).toBe(1500) // 4500 / 3
        })

        it('should return 0 for no reservations', () => {
            const avgTicket = calculateAverageTicket([])
            expect(avgTicket).toBe(0)
        })
    })

    describe('calculateTotalNights', () => {
        it('should calculate total nights sold', () => {
            const nights = calculateTotalNights(mockData)
            expect(nights).toBe(24) // 5 + 5 + 14
        })
    })

    describe('calculateADR', () => {
        it('should calculate average daily rate', () => {
            const adr = calculateADR(mockData)
            expect(adr).toBeCloseTo(187.5, 1) // 4500 / 24
        })

        it('should return 0 when no nights', () => {
            const emptyData: IntegratedData[] = [
                {
                    ...mockData[0],
                    reservas: [],
                },
            ]
            const adr = calculateADR(emptyData)
            expect(adr).toBe(0)
        })
    })

    describe('calculateTotalGuests', () => {
        it('should calculate total guests', () => {
            const guests = calculateTotalGuests(mockData)
            expect(guests).toBe(9) // 2 + 4 + 3
        })
    })

    describe('calculateOccupancyRate', () => {
        it('should calculate occupancy rate', () => {
            const rate = calculateOccupancyRate(
                mockData,
                '2026-01-10',
                '2026-01-15',
                undefined
            )
            expect(rate).toBeGreaterThan(0)
            expect(rate).toBeLessThanOrEqual(100)
        })

        it('should return 0 for invalid date range', () => {
            const rate = calculateOccupancyRate(
                mockData,
                '2026-01-15',
                '2026-01-10', // End before start
                undefined
            )
            expect(rate).toBe(0)
        })
    })

    describe('calculateRevenueByPartner', () => {
        it('should calculate revenue by partner', () => {
            const partnerStats = calculateRevenueByPartner(mockData)
            expect(partnerStats.length).toBe(2) // Airbnb and Booking

            const airbnb = partnerStats.find((p) => p.partner === 'Airbnb')
            expect(airbnb).toBeDefined()
            expect(airbnb?.revenue).toBe(3000) // 1000 + 2000
            expect(airbnb?.count).toBe(2)
        })

        it('should sort by revenue descending', () => {
            const partnerStats = calculateRevenueByPartner(mockData)
            expect(partnerStats[0].revenue).toBeGreaterThanOrEqual(partnerStats[1].revenue)
        })

        it('should calculate percentage correctly', () => {
            const partnerStats = calculateRevenueByPartner(mockData)
            const totalPercentage = partnerStats.reduce((sum, p) => sum + p.percentage, 0)
            expect(totalPercentage).toBeCloseTo(100, 1)
        })
    })

    describe('calculateGoalAchievement', () => {
        it('should calculate goal achievement', () => {
            const achievement = calculateGoalAchievement(mockData)
            expect(achievement.achieved).toBe(4500)
            expect(achievement.goal).toBe(8000) // 5000 + 3000
            expect(achievement.percentage).toBeCloseTo(56.25, 1) // 4500/8000 * 100
        })

        it('should return 0% when no goal', () => {
            const noGoalData: IntegratedData[] = [
                {
                    ...mockData[0],
                    metricas: {
                        ...mockData[0].metricas,
                        metaMensal: 0,
                    },
                },
            ]
            const achievement = calculateGoalAchievement(noGoalData)
            expect(achievement.percentage).toBe(0)
        })
    })

    describe('calculateAverageLeadTime', () => {
        it('should calculate average lead time', () => {
            const leadTime = calculateAverageLeadTime(mockData)
            expect(leadTime).toBeCloseTo(15.33, 1) // (9 + 15 + 22) / 3
        })
    })

    describe('getTopProperties', () => {
        it('should return top properties by revenue', () => {
            const topProps = getTopProperties(mockData, 10)
            expect(topProps.length).toBe(2)
            expect(topProps[0].revenue).toBeGreaterThanOrEqual(topProps[1].revenue)
        })

        it('should limit results', () => {
            const topProps = getTopProperties(mockData, 1)
            expect(topProps.length).toBe(1)
        })

        it('should include property details', () => {
            const topProps = getTopProperties(mockData, 10)
            expect(topProps[0]).toHaveProperty('id')
            expect(topProps[0]).toHaveProperty('name')
            expect(topProps[0]).toHaveProperty('revenue')
            expect(topProps[0]).toHaveProperty('reservations')
            expect(topProps[0]).toHaveProperty('averageTicket')
        })
    })

    describe('calculateConversionMetrics', () => {
        it('should calculate conversion metrics', () => {
            const metrics = calculateConversionMetrics(mockData)
            expect(metrics.totalProperties).toBe(2)
            expect(metrics.propertiesWithSales).toBe(2)
            expect(metrics.conversionRate).toBe(100)
            expect(metrics.averageSalesPerProperty).toBe(1.5) // 3 sales / 2 properties
        })

        it('should handle properties without sales', () => {
            const dataWithEmpty: IntegratedData[] = [
                ...mockData,
                {
                    ...mockData[0],
                    propriedade: {
                        ...mockData[0].propriedade,
                        idpropriedade: '3',
                    },
                    reservas: [],
                },
            ]
            const metrics = calculateConversionMetrics(dataWithEmpty)
            expect(metrics.totalProperties).toBe(3)
            expect(metrics.propertiesWithSales).toBe(2)
            expect(metrics.conversionRate).toBeCloseTo(66.67, 1)
        })
    })

    describe('hasValidData', () => {
        it('should return true for valid data', () => {
            expect(hasValidData(mockData)).toBe(true)
        })

        it('should return false for empty data', () => {
            expect(hasValidData([])).toBe(false)
        })

        it('should return false when filters exclude all data', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                pracas: ['Nonexistent'],
            }
            expect(hasValidData(mockData, filters)).toBe(false)
        })
    })

    describe('getSafeMetrics', () => {
        it('should return metrics for valid data', () => {
            const metrics = getSafeMetrics(mockData)
            expect(metrics.hasData).toBe(true)
            expect(metrics.revenue).toBe(4500)
            expect(metrics.reservations).toBe(3)
            expect(metrics.averageTicket).toBe(1500)
            expect(metrics.nights).toBe(24)
        })

        it('should return zero metrics for empty data', () => {
            const metrics = getSafeMetrics([])
            expect(metrics.hasData).toBe(false)
            expect(metrics.revenue).toBe(0)
            expect(metrics.reservations).toBe(0)
            expect(metrics.averageTicket).toBe(0)
            expect(metrics.adr).toBe(0)
            expect(metrics.nights).toBe(0)
        })

        it('should handle filtered empty results', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                pracas: ['Nonexistent'],
            }
            const metrics = getSafeMetrics(mockData, filters)
            expect(metrics.hasData).toBe(false)
            expect(metrics.revenue).toBe(0)
        })
    })

    describe('Edge Cases', () => {
        it('should handle division by zero gracefully', () => {
            const emptyData: IntegratedData[] = []
            expect(calculateAverageTicket(emptyData)).toBe(0)
            expect(calculateADR(emptyData)).toBe(0)
            expect(calculateAverageLeadTime(emptyData)).toBe(0)
        })

        it('should handle null/undefined values', () => {
            const dataWithNulls: IntegratedData[] = [
                {
                    ...mockData[0],
                    reservas: [
                        {
                            ...mockData[0].reservas[0],
                            reservetotal: 0,
                            nightcount: 0,
                        },
                    ],
                },
            ]
            expect(() => calculateTotalRevenue(dataWithNulls)).not.toThrow()
            expect(() => calculateADR(dataWithNulls)).not.toThrow()
        })
    })
})
