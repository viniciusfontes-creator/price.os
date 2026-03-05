
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Minus, ExternalLink, Users } from "lucide-react"
import { CompetitorDetailsDialog } from './competitor-details-dialog'
import { Button } from "@/components/ui/button"

interface DailyPoint {
    id: string;
    name: string;
    price: number;
    fullData?: any; // To pass to details dialog
    isInternal?: boolean;
}

interface DailyCompositionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    date: Date | null;
    avgPrice: number;
    internalAvgPrice?: number;
    items: DailyPoint[];
    history?: { date: string, value: number, items: any[] }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-popover border text-popover-foreground shadow-lg rounded-lg p-3 min-w-[200px] max-w-[300px] z-50">
                <div className="font-semibold border-b pb-2 mb-2">
                    {format(new Date(label), "d 'de' MMMM", { locale: ptBR })}
                </div>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Média do Dia:</span>
                    <span className="text-sm font-bold text-primary">
                        R$ {data.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 mt-2 font-semibold">
                    Composição ({data.items?.filter((i: any) => !i.isInternal).length || 0}):
                </div>
                <div className="space-y-1 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                    {data.items?.filter((i: any) => !i.isInternal).map((item: any) => (
                        <div key={item.id} className="flex justify-between text-xs">
                            <span className="truncate mr-2 max-w-[150px] opacity-80" title={item.name}>
                                {item.name}
                            </span>
                            <span className="font-medium whitespace-nowrap">
                                R$ {item.price.toLocaleString('pt-BR')}
                            </span>
                        </div>
                    ))}
                    {(!data.items || data.items.length === 0) && (
                        <span className="text-xs text-muted-foreground italic">Sem detalhes</span>
                    )}
                </div>
            </div>
        );
    }
    return null;
};

export function DailyCompositionDialog({ open, onOpenChange, date, avgPrice, internalAvgPrice, items, history }: DailyCompositionDialogProps) {
    if (!date) return null;

    // Calculate trend
    let changePercent = 0;
    let TrendIcon = Minus;
    let trendColor = "text-muted-foreground";

    if (history && history.length >= 2) {
        const first = history[0].value;
        const last = history[history.length - 1].value;
        if (first > 0) {
            changePercent = ((last - first) / first) * 100;
        }
        if (changePercent > 0.5) {
            TrendIcon = TrendingUp;
            trendColor = "text-red-500"; // Price up usually bad for traveler, good for host revenue but competitive disadvantage
        } else if (changePercent < -0.5) {
            TrendIcon = TrendingDown;
            trendColor = "text-green-500"; // Price down
        }
    }

    // Calculate average guests (only from properties that have this info)
    let guestsCount = 0;
    const totalGuests = items.reduce((acc, item) => {
        const guests = item.fullData?.airbnb_data?.hospedes_adultos;
        if (guests) {
            guestsCount++;
            return acc + guests;
        }
        return acc;
    }, 0);
    const avgGuests = guestsCount > 0 ? totalGuests / guestsCount : 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader className="pb-2">
                    <DialogTitle className="flex flex-col gap-1">
                        <span>Composição do Preço</span>
                        <span className="text-sm font-normal text-muted-foreground capitalize">
                            {format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-6 overflow-y-auto pr-2 pb-4">

                    {/* Header Card with Chart */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                        <div className="p-4 flex flex-col gap-4">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-8">
                                    {/* Mercado Externo - Foco Principal */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Média do Mercado</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-4xl font-bold tracking-tight text-blue-600">
                                                R$ {avgPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>

                                            <div className="flex flex-col gap-1 items-start">
                                                {/* Somente a flutuação do mercado externo */}
                                                {history && history.length >= 2 && (
                                                    <div className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded-md bg-muted/50 ${trendColor}`} title="Variação da média do mercado desde a primeira extração">
                                                        <TrendIcon className="w-3.5 h-3.5 mr-1" />
                                                        {Math.abs(changePercent).toFixed(1)}%
                                                    </div>
                                                )}
                                                {avgGuests > 0 && (
                                                    <div className="flex items-center text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 rounded-md bg-muted/50" title="Média de Hóspedes">
                                                        <Users className="w-3 h-3 mr-1" />
                                                        {avgGuests.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Média Interna - Minimalista */}
                                    {internalAvgPrice !== undefined && (
                                        <div className="pl-8 border-l">
                                            <span className="text-xs font-semibold text-sky-500/80 uppercase tracking-wider mb-1 block">Média Interna</span>
                                            <span className="text-2xl font-bold text-sky-500">
                                                R$ {internalAvgPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Evolution Chart */}
                            {history && history.length > 1 && (
                                <div className="h-[120px] w-full mt-2 -ml-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={history}>
                                            <defs>
                                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis
                                                dataKey="date"
                                                hide
                                            />
                                            <YAxis
                                                hide
                                                domain={['auto', 'auto']}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#2563eb"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorPrice)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                            {(!history || history.length <= 1) && (
                                <div className="text-xs text-muted-foreground italic pl-1">Sem histórico suficiente para gráfico.</div>
                            )}
                        </div>
                    </div>

                    {/* Competitors List */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                {items.length} Concorrentes
                            </h4>
                            <span className="text-[10px] text-muted-foreground">Clique para detalhes</span>
                        </div>

                        <ScrollArea className="h-[320px] pr-2">
                            <div className="space-y-2">
                                {items.map((item) => {
                                    const guestsCount = item.fullData?.airbnb_data?.hospedes_adultos;
                                    const displayName = `${item.name}${guestsCount ? ` - ${guestsCount} adultos` : ''}`;

                                    return (
                                        <CompetitorDetailsDialog
                                            key={item.id}
                                            competitor={{
                                                id: item.id,
                                                name: displayName,
                                                url: item.isInternal ? `https://beto.stays.com.br/i/apartment/${item.fullData?.internal_property_data?.idpropriedade || item.id}` : item.fullData?.airbnb_data?.url_anuncio,
                                                avgRating: item.fullData?.airbnb_data?.media_avaliacao,
                                                guests: guestsCount,
                                                history: item.fullData?.history
                                            }}
                                            trigger={
                                                <div
                                                    className={`group flex items-center justify-between p-3 rounded-lg border ${item.isInternal ? 'bg-sky-50/50 border-sky-200/50 hover:bg-sky-50 hover:border-sky-300' : 'bg-background hover:bg-muted/40 hover:border-primary/20'} transition-all cursor-pointer shadow-sm hover:shadow`}
                                                >
                                                    <div className="flex flex-col overflow-hidden mr-4">
                                                        <span className={`font-medium text-sm truncate ${item.isInternal ? 'text-sky-700' : 'group-hover:text-primary'} transition-colors`} title={item.name}>
                                                            {displayName}
                                                        </span>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                                                ID: {item.id}
                                                            </span>
                                                            {item.isInternal && (
                                                                <span className="text-[10px] text-sky-600 font-bold tracking-wider uppercase px-1.5 py-0.5 bg-sky-100 rounded">
                                                                    Interno
                                                                </span>
                                                            )}
                                                            {(item.isInternal || item.fullData?.airbnb_data?.url_anuncio) && (
                                                                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-50 group-hover:opacity-100" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`font-bold whitespace-nowrap text-sm ${item.isInternal ? 'text-sky-700' : ''}`}>
                                                            R$ {item.price.toLocaleString('pt-BR')}
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        />
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
