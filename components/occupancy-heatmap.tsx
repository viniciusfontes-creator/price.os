'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
    format,
    isSameDay,
    parseISO,
    startOfDay,
    isWithinInterval,
    subDays,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    addMonths,
    subMonths,
    startOfWeek,
    endOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { IntegratedData } from '@/contexts/dashboard-provider'

interface OccupancyHeatmapProps {
    /** Propriedades para calcular ocupação */
    properties: IntegratedData[]
    /** Título customizado */
    title?: string
    /** Mês inicial (default: mês atual) */
    initialMonth?: Date
    /** Callback quando data é clicada */
    onDateClick?: (date: Date, occupancyData: OccupancyData) => void
    /** Classe CSS adicional */
    className?: string
}

interface OccupancyData {
    pct: number
    occ: number
    blk: number
    avail: number
}

/**
 * Componente de heatmap de ocupação mensal
 *
 * Mostra calendário com % de ocupação por dia, color-coded:
 * - Verde (≥70%): Alta ocupação
 * - Amber (40-69%): Média ocupação
 * - Vermelho (<40%): Baixa ocupação
 */
export function OccupancyHeatmap({
    properties,
    title = 'Ocupação Mensal',
    initialMonth,
    onDateClick,
    className
}: OccupancyHeatmapProps) {
    const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(initialMonth || new Date()))
    const today = useMemo(() => startOfDay(new Date()), [])

    // Helper para verificar se propriedade está ocupada
    function isOccupied(property: IntegratedData, date: Date, dateStr: string): boolean {
        const occ = property.ocupacao?.find((o: any) => o.datas === dateStr)
        if (occ) return occ.ocupado === 1

        return property.reservas?.some((r: any) => {
            if (!r.checkindate || !r.checkoutdate) return false
            try {
                return isWithinInterval(date, {
                    start: parseISO(r.checkindate),
                    end: subDays(parseISO(r.checkoutdate), 1)
                })
            } catch {
                return false
            }
        }) || false
    }

    // Helper para obter status da propriedade
    function getStatus(property: IntegratedData, date: Date, dateStr: string): 'occupied' | 'blocked' | 'available' {
        const occ = property.ocupacao?.find((o: any) => o.datas === dateStr)
        if (occ) {
            if (occ.ocupado === 1) return 'occupied'
            if (occ.manutencao === 1 || occ.ocupado_proprietario === 1) return 'blocked'
            return 'available'
        }
        return isOccupied(property, date, dateStr) ? 'occupied' : 'available'
    }

    // Calcular semanas do calendário
    const calendarWeeks = useMemo(() => {
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(currentMonth)
        const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
        const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
        const days = eachDayOfInterval({ start: calStart, end: calEnd })
        const weeks: Date[][] = []
        for (let i = 0; i < days.length; i += 7) {
            weeks.push(days.slice(i, i + 7))
        }
        return weeks
    }, [currentMonth])

    // Calcular mapa de ocupação
    const occupancyMap = useMemo(() => {
        const map: Record<string, OccupancyData> = {}
        if (properties.length === 0) return map

        const allCalDays = calendarWeeks.flat()
        allCalDays.forEach(date => {
            const ds = format(date, 'yyyy-MM-dd')
            let occ = 0, blk = 0, avail = 0

            properties.forEach(p => {
                const status = getStatus(p, date, ds)
                if (status === 'occupied') occ++
                else if (status === 'blocked') blk++
                else avail++
            })

            const total = properties.length
            map[ds] = {
                pct: total > 0 ? Math.round((occ / total) * 100) : 0,
                occ,
                blk,
                avail
            }
        })

        return map
    }, [properties, calendarWeeks])

    // Funções de coloração
    function occBg(pct: number): string {
        if (pct >= 70) return 'bg-emerald-50'
        if (pct >= 40) return 'bg-amber-50'
        return 'bg-red-50'
    }

    function occText(pct: number): string {
        if (pct >= 70) return 'text-emerald-700'
        if (pct >= 40) return 'text-amber-700'
        return 'text-red-700'
    }

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setCurrentMonth(m => subMonths(m, 1))}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        aria-label="Mês anterior"
                    >
                        <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                    </button>
                    <CardTitle className="text-base font-semibold capitalize">
                        {title} • {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </CardTitle>
                    <button
                        onClick={() => setCurrentMonth(m => addMonths(m, 1))}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        aria-label="Próximo mês"
                    >
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>
            </CardHeader>
            <CardContent>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                        <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="space-y-1.5">
                    {calendarWeeks.map((week, wi) => (
                        <div key={wi} className="grid grid-cols-7 gap-1.5">
                            {week.map(date => {
                                const ds = format(date, 'yyyy-MM-dd')
                                const data = occupancyMap[ds]
                                const inMonth = isSameMonth(date, currentMonth)
                                const isToday = isSameDay(date, today)
                                const pct = data?.pct ?? 0

                                return (
                                    <button
                                        key={ds}
                                        onClick={() => onDateClick?.(date, data)}
                                        disabled={!inMonth}
                                        className={`relative flex flex-col items-center justify-center rounded-lg py-2 px-1 transition-all
                                            ${inMonth ? 'hover:ring-2 hover:ring-primary/30 cursor-pointer' : 'opacity-25 pointer-events-none'}
                                            ${isToday ? 'ring-2 ring-primary' : ''}
                                            ${inMonth ? occBg(pct) : ''}
                                        `}
                                    >
                                        <span className={`text-xs font-medium ${isToday ? 'text-primary' : inMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {format(date, 'd')}
                                        </span>
                                        {inMonth && data && (
                                            <span className={`text-[10px] font-semibold leading-tight ${occText(pct)}`}>
                                                {pct}%
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    ))}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-emerald-100" /> ≥70%
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-amber-100" /> 40–69%
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-red-100" /> &lt;40%
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
