'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ExternalLink, Clock, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'

interface CompetitorData {
    id: string | number;
    name: string;
    url?: string;
    avgRating?: string;
    guests?: number;
    history?: any[];
}

interface CompetitorDetailsDialogProps {
    competitor: CompetitorData;
    trigger?: React.ReactNode;
}

export function CompetitorDetailsDialog({ competitor, trigger }: CompetitorDetailsDialogProps) {
    // Process history
    const historyPoints = (competitor.history || []).map((h: any) => ({
        extractionDate: h.data_extracao ? new Date(h.data_extracao) : null,
        checkinDate: h.checkin_formatado ? new Date(h.checkin_formatado) : null,
        price: h.preco_por_noite || (h.preco_total && h.quantidade_noites ? h.preco_total / h.quantidade_noites : 0),
        nights: h.quantidade_noites,
        guests: h.quantidade_hospedes || h.hospedes_adultos,
        rawDate: h.checkin_formatado // for chart key
    })).filter((h: any) => h.price > 0 && h.checkinDate)
        .sort((a: any, b: any) => {
            // Sort by checkin date for the chart
            if (a.checkinDate && b.checkinDate) {
                return a.checkinDate.getTime() - b.checkinDate.getTime();
            }
            return 0;
        });

    // Chart Data (Group by Checkin Date, take latest extraction)
    const uniqueCheckins = new Map();
    historyPoints.forEach((p: any) => {
        if (!p.checkinDate) return;
        const key = format(p.checkinDate, 'yyyy-MM-dd');
        // We might have multiple points for same checkin if multiple extractions.
        // We prioritize the point with LATER extraction date (most recent data for that checkin)
        if (!uniqueCheckins.has(key) || (p.extractionDate && uniqueCheckins.get(key).extractionDate < p.extractionDate)) {
            uniqueCheckins.set(key, p);
        }
    });

    const chartData = Array.from(uniqueCheckins.values())
        .map((p: any) => ({
            date: format(p.checkinDate, 'dd/MM'),
            fullDate: format(p.checkinDate, 'dd/MM/yyyy'),
            price: p.price
        }))
        .sort((a, b) => { // ensure sorted by date
            const da = new Date(a.fullDate.split('/').reverse().join('-'));
            const db = new Date(b.fullDate.split('/').reverse().join('-'));
            return da.getTime() - db.getTime();
        });

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <DialogTitle className="text-xl leading-relaxed">{competitor.name}</DialogTitle>
                            <DialogDescription className="flex items-center gap-2 pt-1">
                                <span className="font-mono text-xs block truncate bg-muted p-1 rounded">ID: {competitor.id}</span>
                                {competitor.avgRating && (
                                    <Badge variant="secondary" className="text-xs">
                                        ★ {competitor.avgRating}
                                    </Badge>
                                )}
                            </DialogDescription>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                            <a href={competitor.url || `https://www.airbnb.com.br/rooms/${competitor.id}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Ver no Airbnb
                            </a>
                        </Button>
                    </div>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Price Chart */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Evolução de Preço (Curva Futura)
                        </h3>
                        <div className="h-[250px] w-full border rounded-lg p-4 bg-muted/10">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 12 }}
                                            minTickGap={30}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 12 }}
                                            tickFormatter={(val) => `R$${val}`}
                                        />
                                        <Tooltip
                                            formatter={(value: any) => [`R$ ${Number(value).toFixed(0)}`, 'Preço']}
                                            labelFormatter={(label: any) => `Check-in: ${label}`}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="price"
                                            stroke="#f97316"
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                    Sem dados suficientes para o gráfico.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* History Table */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Histórico Detalhado
                        </h3>
                        <div className="border rounded-md overflow-hidden">
                            <ScrollArea className="h-[300px]">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead>Check-in</TableHead>
                                            <TableHead>Data Extração</TableHead>
                                            <TableHead className="text-right">Preço</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historyPoints.length > 0 ? (
                                            historyPoints.slice().reverse().map((point: any, i: number) => ( // Show latest first
                                                <TableRow key={i}>
                                                    <TableCell className="font-medium">
                                                        {point.checkinDate ? format(point.checkinDate, "dd/MM/yyyy") : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground flex flex-col gap-0.5">
                                                        <span>{point.extractionDate ? format(point.extractionDate, "dd/MM/yy HH:mm") : '-'}</span>
                                                        {point.guests && <span className="text-[10px] text-muted-foreground/70">({point.guests} adultos)</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">
                                                        R$ {point.price?.toFixed(2)}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                                    Nenhum histórico disponível.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
