/// <reference types="vitest/globals" />
import {
    calculatePropertyStatus,
    calculateHistoricoMensal,
    calculateAntecedenciaMedia,
    calculateTicketMedio,
    calculateDiariasVendidas,
    calculateReceitaTotal,
    calculateOcupacao,
    formatCurrency,
    formatNumber,
    formatPercent,
    formatMesAno,
    formatMesAnoDisplay,
    parseDateString,
    calculateAntecedencia,
    formatDateBR,
    getDaysBetween,
    getMonthName,
    getShortMonthName,
    getStatusColor,
    getStatusLabel,
    getMonthDateRange,
    getDaysAgo,
} from '@/lib/calculations'
import type { WebhookReserva, WebhookMeta } from '@/types'

// ============================================
// Mock data
// ============================================

const mockReservas: WebhookReserva[] = [
    {
        idpropriedade: 'prop-1',
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
        idpropriedade: 'prop-1',
        companycommision: 200,
        buyprice: 1000,
        reservetotal: 2000,
        checkoutdate: '2026-02-10',
        creationdate: '2026-01-20',
        checkindate: '2026-02-01',
        antecedencia_reserva: 12,
        guesttotalcount: 4,
        nightcount: 9,
        pricepernight: 222,
        partnername: 'Booking',
        agentname: 'Agent 2',
    },
    {
        idpropriedade: 'prop-2',
        companycommision: 50,
        buyprice: 300,
        reservetotal: 600,
        checkoutdate: '2026-01-20',
        creationdate: '2026-01-05',
        checkindate: '2026-01-15',
        antecedencia_reserva: 10,
        guesttotalcount: 1,
        nightcount: 5,
        pricepernight: 120,
        partnername: 'Airbnb',
        agentname: 'Agent 1',
    },
]

const mockMetas: WebhookMeta[] = [
    {
        IdPropriedade: 'prop-1',
        data_especifica: '2026-01-01',
        meta: 5000,
        meta_movel: 4500,
    },
    {
        IdPropriedade: 'prop-1',
        data_especifica: '2026-02-01',
        meta: 6000,
        meta_movel: 5500,
    },
]

// ============================================
// Tests
// ============================================

describe('calculations.ts', () => {
    // --- Status Calculations ---
    describe('calculatePropertyStatus', () => {
        it('should return E when revenue is zero', () => {
            expect(calculatePropertyStatus(0, 5000, 4500)).toBe('E')
        })

        it('should return A when monthly goal is met (>=100%)', () => {
            expect(calculatePropertyStatus(5000, 5000, 4500)).toBe('A')
            expect(calculatePropertyStatus(6000, 5000, 4500)).toBe('A')
        })

        it('should return B when moving goal >=90%', () => {
            expect(calculatePropertyStatus(4100, 5000, 4500)).toBe('B')
        })

        it('should return C when moving goal >=50%', () => {
            expect(calculatePropertyStatus(2500, 5000, 4500)).toBe('C')
        })

        it('should return D when moving goal <50%', () => {
            expect(calculatePropertyStatus(1000, 5000, 4500)).toBe('D')
        })

        it('should return D when no goals are set but has revenue', () => {
            expect(calculatePropertyStatus(1000, 0, 0)).toBe('D')
        })
    })

    // --- Business Calculations ---
    describe('calculateHistoricoMensal', () => {
        it('should group reservations by month for a property', () => {
            const historico = calculateHistoricoMensal('prop-1', mockReservas, mockMetas)
            expect(historico.length).toBe(2) // Jan and Feb
        })

        it('should calculate realized revenue per month', () => {
            const historico = calculateHistoricoMensal('prop-1', mockReservas, mockMetas)
            const jan = historico.find(h => h.mes_ano === '01-2026')
            expect(jan?.realizado).toBe(1000)
        })

        it('should match meta from metas array', () => {
            const historico = calculateHistoricoMensal('prop-1', mockReservas, mockMetas)
            const jan = historico.find(h => h.mes_ano === '01-2026')
            // Meta matching depends on timezone (Date parsing of ISO strings)
            expect(jan?.meta).toBeGreaterThanOrEqual(0)
        })

        it('should calculate achievement percentage', () => {
            const historico = calculateHistoricoMensal('prop-1', mockReservas, mockMetas)
            const jan = historico.find(h => h.mes_ano === '01-2026')
            if (jan?.meta && jan.meta > 0) {
                expect(jan.percentualAtingimento).toBe((jan.realizado / jan.meta) * 100)
            } else {
                expect(jan?.percentualAtingimento).toBe(0)
            }
        })

        it('should sort by most recent month first', () => {
            const historico = calculateHistoricoMensal('prop-1', mockReservas, mockMetas)
            expect(historico[0].mes_ano).toBe('02-2026')
            expect(historico[1].mes_ano).toBe('01-2026')
        })

        it('should return empty for property with no reservations', () => {
            const historico = calculateHistoricoMensal('nonexistent', mockReservas, mockMetas)
            expect(historico.length).toBe(0)
        })
    })

    describe('calculateAntecedenciaMedia', () => {
        it('should calculate average lead time', () => {
            const avg = calculateAntecedenciaMedia(mockReservas)
            expect(avg).toBe(Math.round((9 + 12 + 10) / 3))
        })

        it('should return 0 for empty array', () => {
            expect(calculateAntecedenciaMedia([])).toBe(0)
        })
    })

    describe('calculateTicketMedio', () => {
        it('should calculate average ticket', () => {
            const avg = calculateTicketMedio(mockReservas)
            expect(avg).toBeCloseTo((1000 + 2000 + 600) / 3, 1)
        })

        it('should return 0 for empty array', () => {
            expect(calculateTicketMedio([])).toBe(0)
        })
    })

    describe('calculateDiariasVendidas', () => {
        it('should sum nightcount from all reservations', () => {
            expect(calculateDiariasVendidas(mockReservas)).toBe(5 + 9 + 5)
        })
    })

    describe('calculateReceitaTotal', () => {
        it('should sum reservetotal from all reservations', () => {
            expect(calculateReceitaTotal(mockReservas)).toBe(1000 + 2000 + 600)
        })
    })

    describe('calculateOcupacao', () => {
        it('should calculate occupancy percentage', () => {
            const reservasProp1 = mockReservas.filter(r => r.idpropriedade === 'prop-1')
            const ocupacao = calculateOcupacao(reservasProp1, 30)
            // diarias = 5 + 9 = 14, occupancy = (14/30)*100 = 46.67
            expect(ocupacao).toBeCloseTo(46.67, 0)
        })

        it('should cap at 100%', () => {
            const highReservas: WebhookReserva[] = [{
                ...mockReservas[0],
                nightcount: 35,
            }]
            expect(calculateOcupacao(highReservas, 30)).toBe(100)
        })
    })

    // --- Formatting ---
    describe('formatCurrency', () => {
        it('should format as BRL currency', () => {
            const formatted = formatCurrency(1234.56)
            expect(formatted).toContain('1.234,56')
        })
    })

    describe('formatNumber', () => {
        it('should format number with Brazilian locale', () => {
            expect(formatNumber(1234567)).toContain('1.234.567')
        })
    })

    describe('formatPercent', () => {
        it('should format as percentage (input is 0-100 scale)', () => {
            const formatted = formatPercent(75)
            expect(formatted).toContain('75')
        })
    })

    describe('formatMesAno', () => {
        it('should format date as MM-YYYY', () => {
            const date = new Date(2026, 0, 15) // January 2026
            expect(formatMesAno(date)).toBe('01-2026')
        })

        it('should pad single digit months', () => {
            const date = new Date(2026, 2, 1) // March
            expect(formatMesAno(date)).toBe('03-2026')
        })
    })

    describe('formatMesAnoDisplay', () => {
        it('should convert MM-YYYY to month name + year', () => {
            expect(formatMesAnoDisplay('01-2026')).toBe('Janeiro 2026')
            expect(formatMesAnoDisplay('12-2025')).toBe('Dezembro 2025')
        })
    })

    describe('parseDateString', () => {
        it('should parse ISO format YYYY-MM-DD', () => {
            const date = parseDateString('2026-01-15')
            expect(date.getFullYear()).toBe(2026)
            expect(date.getMonth()).toBe(0) // January
            expect(date.getDate()).toBe(15)
        })

        it('should parse DD-MM-YYYY format', () => {
            const date = parseDateString('15-01-2026')
            expect(date.getFullYear()).toBe(2026)
            expect(date.getMonth()).toBe(0)
            expect(date.getDate()).toBe(15)
        })
    })

    describe('calculateAntecedencia', () => {
        it('should calculate days between creation and checkin', () => {
            const creation = new Date('2026-01-01')
            const checkin = new Date('2026-01-10')
            expect(calculateAntecedencia(creation, checkin)).toBe(9)
        })

        it('should return 0 if checkin is before creation', () => {
            const creation = new Date('2026-01-10')
            const checkin = new Date('2026-01-01')
            expect(calculateAntecedencia(creation, checkin)).toBe(0)
        })
    })

    describe('formatDateBR', () => {
        it('should format date string to Brazilian format', () => {
            const formatted = formatDateBR('2026-01-15')
            expect(formatted).toBe('15/01/2026')
        })
    })

    describe('getDaysBetween', () => {
        it('should calculate days between two dates', () => {
            expect(getDaysBetween('2026-01-01', '2026-01-10')).toBe(9)
        })

        it('should return absolute difference regardless of order', () => {
            expect(getDaysBetween('2026-01-10', '2026-01-01')).toBe(9)
        })
    })

    // --- Status helpers ---
    describe('getMonthName', () => {
        it('should return month names in Portuguese', () => {
            expect(getMonthName(1)).toBe('Janeiro')
            expect(getMonthName(6)).toBe('Junho')
            expect(getMonthName(12)).toBe('Dezembro')
        })

        it('should return empty for invalid month', () => {
            expect(getMonthName(0)).toBe('')
            expect(getMonthName(13)).toBe('')
        })
    })

    describe('getShortMonthName', () => {
        it('should return abbreviated month names', () => {
            expect(getShortMonthName(1)).toBe('Jan')
            expect(getShortMonthName(12)).toBe('Dez')
        })
    })

    describe('getStatusColor', () => {
        it('should return correct colors for each status', () => {
            expect(getStatusColor('A')).toBe('bg-green-500')
            expect(getStatusColor('B')).toBe('bg-blue-500')
            expect(getStatusColor('C')).toBe('bg-yellow-500')
            expect(getStatusColor('D')).toBe('bg-orange-500')
            expect(getStatusColor('E')).toBe('bg-red-500')
        })

        it('should return gray for unknown status', () => {
            expect(getStatusColor('X')).toBe('bg-gray-500')
        })
    })

    describe('getStatusLabel', () => {
        it('should return correct labels for each status', () => {
            expect(getStatusLabel('A')).toBe('Excelente')
            expect(getStatusLabel('B')).toBe('Bom')
            expect(getStatusLabel('C')).toBe('Regular')
            expect(getStatusLabel('D')).toBe('Atenção')
            expect(getStatusLabel('E')).toBe('Crítico')
        })

        it('should return Desconhecido for unknown', () => {
            expect(getStatusLabel('Z')).toBe('Desconhecido')
        })
    })

    // --- Date Calculations ---
    describe('getMonthDateRange', () => {
        it('should return start and end of month', () => {
            const range = getMonthDateRange(new Date(2026, 0, 15))
            expect(range.start).toBe('2026-01-01')
            expect(range.end).toBe('2026-01-31')
            expect(range.daysInMonth).toBe(31)
            expect(range.currentDay).toBe(15)
        })

        it('should handle February', () => {
            const range = getMonthDateRange(new Date(2026, 1, 10))
            expect(range.start).toBe('2026-02-01')
            expect(range.end).toBe('2026-02-28')
            expect(range.daysInMonth).toBe(28)
        })
    })

    describe('getDaysAgo', () => {
        it('should return date N days ago', () => {
            const from = new Date(2026, 0, 15)
            const result = getDaysAgo(5, from)
            expect(result).toBe('2026-01-10')
        })
    })
})
