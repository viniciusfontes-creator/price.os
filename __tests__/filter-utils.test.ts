import { describe, it, expect } from '@jest/globals'
import { applyGlobalFilters, getFilterOptions, getDatePresets } from '@/lib/filter-utils'
import { DEFAULT_FILTERS } from '@/types'
import type { IntegratedData, GlobalFilters } from '@/types'

// Mock data for testing
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

describe('Filter Utils', () => {
    describe('applyGlobalFilters', () => {
        it('should return all data when no filters are applied', () => {
            const result = applyGlobalFilters(mockData, DEFAULT_FILTERS)
            expect(result.length).toBe(2)
        })

        it('should filter by praça', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                pracas: ['São Paulo'],
            }
            const result = applyGlobalFilters(mockData, filters)
            expect(result.length).toBe(1)
            expect(result[0].propriedade.praca).toBe('São Paulo')
        })

        it('should filter by multiple praças', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                pracas: ['São Paulo', 'Rio de Janeiro'],
            }
            const result = applyGlobalFilters(mockData, filters)
            expect(result.length).toBe(2)
        })

        it('should filter by grupo', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                grupos: ['Grupo A'],
            }
            const result = applyGlobalFilters(mockData, filters)
            expect(result.length).toBe(1)
            expect(result[0].propriedade.grupo_nome).toBe('Grupo A')
        })

        it('should filter by tipo de operação', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                tipoOperacao: ['short stay'],
            }
            const result = applyGlobalFilters(mockData, filters)
            expect(result.length).toBe(1)
            expect(result[0].propriedade.empreendimento_pousada).toBe('short stay')
        })

        it('should filter by date range (checkout)', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                dateRange: { start: '2026-01-01', end: '2026-01-31' },
                dateFilterMode: 'checkout',
            }
            const result = applyGlobalFilters(mockData, filters)
            expect(result.length).toBe(1)
            expect(result[0].propriedade.idpropriedade).toBe('1')
            expect(result[0].reservas.length).toBe(2) // Both reservas in January
        })

        it('should filter by partnername', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                partnernames: ['Booking'],
            }
            const result = applyGlobalFilters(mockData, filters)
            expect(result.length).toBe(1)
            expect(result[0].reservas.length).toBe(1)
            expect(result[0].reservas[0].partnername).toBe('Booking')
        })

        it('should filter by number of guests', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                hospedes: { min: 3, max: 4 },
            }
            const result = applyGlobalFilters(mockData, filters)
            expect(result.length).toBe(2)
            // Check that all reservas have 3-4 guests
            result.forEach((item) => {
                item.reservas.forEach((r) => {
                    expect(r.guesttotalcount).toBeGreaterThanOrEqual(3)
                    expect(r.guesttotalcount).toBeLessThanOrEqual(4)
                })
            })
        })

        it('should filter by revenue range', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                receita: { min: 1500, max: 2500 },
            }
            const result = applyGlobalFilters(mockData, filters)
            expect(result.length).toBe(2)
            result.forEach((item) => {
                item.reservas.forEach((r) => {
                    expect(r.reservetotal).toBeGreaterThanOrEqual(1500)
                    expect(r.reservetotal).toBeLessThanOrEqual(2500)
                })
            })
        })

        it('should combine multiple filters', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                pracas: ['São Paulo'],
                partnernames: ['Airbnb'],
                hospedes: { min: 2, max: 2 },
            }
            const result = applyGlobalFilters(mockData, filters)
            expect(result.length).toBe(1)
            expect(result[0].propriedade.praca).toBe('São Paulo')
            expect(result[0].reservas.length).toBe(1)
            expect(result[0].reservas[0].partnername).toBe('Airbnb')
            expect(result[0].reservas[0].guesttotalcount).toBe(2)
        })

        it('should return empty array when no data matches filters', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                pracas: ['Nonexistent City'],
            }
            const result = applyGlobalFilters(mockData, filters)
            expect(result.length).toBe(0)
        })

        it('should recalculate metrics after filtering', () => {
            const filters: GlobalFilters = {
                ...DEFAULT_FILTERS,
                partnernames: ['Airbnb'],
            }
            const result = applyGlobalFilters(mockData, filters)

            // First property should have only 1 Airbnb reservation
            expect(result[0].reservas.length).toBe(1)
            expect(result[0].metricas.totalReservas).toBe(1)
            expect(result[0].metricas.receitaTotal).toBe(1000)
        })
    })

    describe('getFilterOptions', () => {
        it('should extract unique pracas', () => {
            const options = getFilterOptions(mockData)
            expect(options.pracas).toEqual(['Rio de Janeiro', 'São Paulo'])
        })

        it('should extract unique grupos', () => {
            const options = getFilterOptions(mockData)
            expect(options.grupos).toEqual(['Grupo A', 'Grupo B'])
        })

        it('should extract unique tipo de operação', () => {
            const options = getFilterOptions(mockData)
            expect(options.tipoOperacao).toEqual(['long stay', 'short stay'])
        })

        it('should extract unique partnernames', () => {
            const options = getFilterOptions(mockData)
            expect(options.partnernames).toEqual(['Airbnb', 'Booking'])
        })
    })

    describe('getDatePresets', () => {
        it('should return date presets', () => {
            const presets = getDatePresets()
            expect(presets).toHaveProperty('last7Days')
            expect(presets).toHaveProperty('last30Days')
            expect(presets).toHaveProperty('thisMonth')
            expect(presets).toHaveProperty('lastMonth')
            expect(presets).toHaveProperty('thisQuarter')
            expect(presets).toHaveProperty('thisYear')
        })

        it('should have valid date ranges', () => {
            const presets = getDatePresets()
            Object.values(presets).forEach((preset) => {
                expect(preset).toHaveProperty('start')
                expect(preset).toHaveProperty('end')
                expect(new Date(preset.start)).toBeInstanceOf(Date)
                expect(new Date(preset.end)).toBeInstanceOf(Date)
                expect(new Date(preset.start).getTime()).toBeLessThanOrEqual(
                    new Date(preset.end).getTime()
                )
            })
        })
    })
})
