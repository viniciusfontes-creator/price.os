'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { TrendingUp, TrendingDown, Eye, Users, Calendar, DollarSign } from 'lucide-react'
import { IntegratedData } from '@/types'
import {
    findPeerGroup,
    calculatePeerGroupKPIs,
    compareToPeerGroup,
    getPeerGroupReservations,
    formatCurrency,
    formatPercentage,
    formatDelta,
    PeerGroupKPIs,
    Reservation
} from '@/lib/peer-group-utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface PeerGroupComparisonProps {
    /** Propriedade atual para comparação */
    currentProperty: IntegratedData
    /** Todas as propriedades disponíveis */
    allProperties: IntegratedData[]
    /** Mês para análise (formato: 'YYYY-MM') */
    yearMonth: string
    /** Título customizado */
    title?: string
}

interface KPICardProps {
    title: string
    icon: React.ReactNode
    currentValue: number
    peerValue: number
    delta: number
    formatter: (value: number) => string
    description?: string
    onClick?: () => void
}

function KPICard({ title, icon, currentValue, peerValue, delta, formatter, description, onClick }: KPICardProps) {
    const isPositive = delta > 0
    // Fix: For occupancy rate, usually higher is better. For RAC, maybe lower is better.
    // For now, let's keep it simple: green for positive delta.
    const deltaPercent = peerValue !== 0 ? (delta / peerValue) * 100 : 0

    return (
        <Card
            className="cursor-pointer transition-all hover:bg-muted/50 hover:shadow-sm group border-none bg-muted/20"
            onClick={onClick}
        >
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{title}</span>
                    <div className="p-1.5 bg-background rounded-md text-muted-foreground group-hover:text-primary transition-colors shadow-sm">
                        {icon}
                    </div>
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold tracking-tight">{formatter(currentValue)}</span>
                    <div className={`flex items-center gap-0.5 text-[10px] font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                        <span>{formatDelta(deltaPercent, (v) => formatPercentage(v, 1))}</span>
                    </div>
                </div>
                <div className="mt-1 flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground/60">
                        Peer: <span className="font-medium text-muted-foreground">{formatter(peerValue)}</span>
                    </p>
                    {description && (
                        <p className="text-[10px] text-muted-foreground/40 italic">{description}</p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

export function PeerGroupComparison({
    currentProperty,
    allProperties,
    yearMonth,
    title = "Análise Comparativa - Peer Group"
}: PeerGroupComparisonProps) {
    const [drilldownOpen, setDrilldownOpen] = useState(false)

    // Find peer group
    const peerGroup = useMemo(() => {
        return findPeerGroup(currentProperty, allProperties, {
            roomsTolerance: 1,
            guestsTolerance: 2,
            includeSelf: false
        })
    }, [currentProperty, allProperties])

    // Calculate KPIs
    const { peerGroupKPIs, comparison, reservations } = useMemo(() => {
        const peerKPIs = calculatePeerGroupKPIs(peerGroup, yearMonth)
        const comp = compareToPeerGroup(currentProperty, peerKPIs, yearMonth)
        const res = getPeerGroupReservations([currentProperty], yearMonth)

        return {
            peerGroupKPIs: peerKPIs,
            comparison: comp,
            reservations: res
        }
    }, [peerGroup, currentProperty, yearMonth])

    if (peerGroup.length === 0) {
        return (
            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle className="text-lg">{title}</CardTitle>
                    <CardDescription>
                        Nenhuma propriedade similar encontrada para comparação.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Propriedade: <strong>{currentProperty.propriedade.nomepropriedade}</strong>
                        <br />
                        Praça: <strong>{currentProperty.propriedade.praca}</strong>
                        <br />
                        Quartos: <strong>{currentProperty.propriedade._i_rooms}</strong> | Hóspedes: <strong>{currentProperty.propriedade._i_maxguests}</strong>
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">
                        Comparando com {peerGroupKPIs.propertyCount} {peerGroupKPIs.propertyCount === 1 ? 'propriedade similar' : 'propriedades similares'} • {format(new Date(yearMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}
                    </p>
                </div>
                <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Eye className="h-4 w-4" />
                            Ver Reservas
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Reservas Detalhadas - {currentProperty.propriedade.nomepropriedade}</DialogTitle>
                            <DialogDescription>
                                {reservations.length} {reservations.length === 1 ? 'reserva' : 'reservas'} em {format(new Date(yearMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID Reserva</TableHead>
                                        <TableHead>Hóspede</TableHead>
                                        <TableHead>Check-in</TableHead>
                                        <TableHead>Check-out</TableHead>
                                        <TableHead className="text-right">Noites</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reservations.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                                                Nenhuma reserva encontrada
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        reservations.map((reserva) => (
                                            <TableRow key={reserva.idReserva}>
                                                <TableCell className="font-mono text-xs">{reserva.idReserva}</TableCell>
                                                <TableCell>{reserva.hospede || '-'}</TableCell>
                                                <TableCell>
                                                    {format(typeof reserva.checkindate === 'string' ? parseISO(reserva.checkindate) : reserva.checkindate, 'dd/MM/yyyy')}
                                                </TableCell>
                                                <TableCell>
                                                    {format(typeof reserva.checkoutdate === 'string' ? parseISO(reserva.checkoutdate) : reserva.checkoutdate, 'dd/MM/yyyy')}
                                                </TableCell>
                                                <TableCell className="text-right">{reserva.nightcount || '-'}</TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {formatCurrency(parseFloat(reserva.reservetotal?.toString() || '0'))}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard
                    title="ADR"
                    icon={<DollarSign className="h-3.5 w-3.5" />}
                    currentValue={comparison.currentKPIs.adr}
                    peerValue={peerGroupKPIs.adr}
                    delta={comparison.deltas.adr}
                    formatter={formatCurrency}
                    onClick={() => setDrilldownOpen(true)}
                />
                <KPICard
                    title="Ocupação"
                    icon={<Users className="h-3.5 w-3.5" />}
                    currentValue={comparison.currentKPIs.occupancyRate}
                    peerValue={peerGroupKPIs.occupancyRate}
                    delta={comparison.deltas.occupancyRate}
                    formatter={(v) => formatPercentage(v, 1)}
                    onClick={() => setDrilldownOpen(true)}
                />
                <KPICard
                    title="Tempo RAC"
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    currentValue={comparison.currentKPIs.avgRAC}
                    peerValue={peerGroupKPIs.avgRAC}
                    delta={comparison.deltas.avgRAC}
                    formatter={(v) => v.toFixed(0) + "d"}
                    onClick={() => setDrilldownOpen(true)}
                />
                <KPICard
                    title="Faturamento"
                    icon={<TrendingUp className="h-3.5 w-3.5" />}
                    currentValue={comparison.currentKPIs.totalRevenue}
                    peerValue={peerGroupKPIs.totalRevenue / peerGroupKPIs.propertyCount}
                    delta={comparison.deltas.totalRevenue}
                    formatter={formatCurrency}
                    onClick={() => setDrilldownOpen(true)}
                />
            </div>
        </div>
    )
}
