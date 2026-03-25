import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { MarketKPICards } from '@/components/competitor-kpi-cards';
import { PriceEvolutionChart } from '@/components/price-evolution-chart';
import { DailyCompositionDialog } from '@/components/market-monitor/daily-composition-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Users, CalendarIcon } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface SalesMarketVisionProps {
    lat: number;
    lon: number;
    guests: number;
    startDate: string;
    endDate: string;
    unitName: string;
    unitRates?: { from: string, to: string, baserate: number }[];
    unitBasePrice?: number;
}

// Helpers from concorrencia/page.tsx
const calculateMedian = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function SalesMarketVision({ lat, lon, guests, startDate, endDate, unitName, unitRates, unitBasePrice }: SalesMarketVisionProps) {
    const [radius, setRadius] = useState('10'); // Default to 10km
    
    // Parse e arredonda guests para garantir que um valor como 17.01 venha redondinho (17)
    const baseGuests = Math.round(Number(guests || 2));

    // Calcula guests dinamicamente (se imóvel grande agrupa em um bolsão 9+, senão dá margem ±1)
    const isLargeProperty = baseGuests >= 9;
    const guestsMin = isLargeProperty ? 9 : Math.max(1, baseGuests - 1);
    const guestsMax = isLargeProperty ? 50 : baseGuests + 1;

    // Estado pro dialog de clique no ponto do gráfico
    const [compositionDialog, setCompositionDialog] = useState<{
        open: boolean;
        date: Date;
        avgPrice: number;
        items: any[];
        history: any[];
    }>({
        open: false,
        date: new Date(),
        avgPrice: 0,
        items: [],
        history: []
    });

    const queryParams = useMemo(() => {
        const params = new URLSearchParams({
            lat: lat.toString(),
            lon: lon.toString(),
            radius,
            guestsMin: guestsMin.toString(),
            guestsMax: guestsMax.toString(),
            startDate,
            endDate,
            includeStats: 'true',
            limit: '500' // Limitamos p/ modal
        });
        return params.toString();
    }, [lat, lon, radius, guestsMin, guestsMax, startDate, endDate]);

    const { data: result, error: fetchError, isLoading } = useSWR(
        (lat && lon && startDate && endDate) ? `/api/competitors?${queryParams}` : null,
        fetcher,
        {
            revalidateOnFocus: false,
            keepPreviousData: true
        }
    );

    const competitors = result?.success ? result.data || [] : [];
    const stats = useMemo(() => {
        const rawStats = result?.success ? result.stats || [] : [];
        return rawStats.map((st: any) => {
            const dateStr = st.date;
            const myPrice = unitRates?.find(t => dateStr >= t.from && dateStr <= t.to)?.baserate || unitBasePrice || 0;
            return {
                ...st,
                myPrice
            };
        });
    }, [result, unitRates, unitBasePrice]);
    
    // KPIs Calculation
    const pricesPerNight = competitors.map((c: any) => c.preco_por_noite).filter((p: number) => p > 0);
    const averagePrice = pricesPerNight.length > 0
        ? pricesPerNight.reduce((a: number, b: number) => a + b, 0) / pricesPerNight.length
        : 0;
    const medianPrice = calculateMedian(pricesPerNight);
    
    const ratings = competitors
        .map((c: any) => parseFloat(c.media_avaliacao || '0'))
        .filter((r: number) => !isNaN(r));
    const averageRating = ratings.length > 0
        ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
        : 0;

    const averageGuests = competitors.length > 0
        ? competitors.reduce((a: number, b: any) => a + (b.hospedes_adultos || 0), 0) / competitors.length
        : 0;

    const competitorMap = useMemo(() => {
        const map: Record<string, string> = {};
        competitors.forEach((c: any) => {
            if (c.id_numerica) map[c.id_numerica.toString()] = c.nome_anuncio;
            if (c.id) map[c.id.toString()] = c.nome_anuncio;
        });
        return map;
    }, [competitors]);

    const handlePointClick = (payload: any) => {
        const date = new Date(payload.date);
        const avgPrice = payload.avgPrice;

        const items = Object.keys(payload)
            .filter(k => k.startsWith('listing_'))
            .map(k => {
                const id = k.replace('listing_', '');
                const idString = id.toString();
                const found = competitors.find((c: any) => {
                    const idNum = c.id_numerica ? c.id_numerica.toString() : '';
                    const cId = c.id ? c.id.toString() : '';
                    return idNum === idString || cId === idString || c._extracted_airbnb_id === idString;
                });

                return {
                    id: idString,
                    name: found?.nome_anuncio || competitorMap[idString] || `Anúncio ${idString}`,
                    price: payload[k],
                    fullData: found ? { airbnb_data: found, history: found.history, ...found } : null
                }
            })
            .sort((a, b) => b.price - a.price);

        const historyMap = new Map<string, { sum: number; count: number; items: any[] }>();
        const checkinStr = date.toISOString().split('T')[0];

        items.forEach(item => {
            const historyData = item.fullData?.history || [];
            const extractionsForCheckin = historyData.filter((h: any) =>
                h.checkin_formatado && h.checkin_formatado.startsWith(checkinStr)
            );

            extractionsForCheckin.forEach((ext: any) => {
                const rawDate = ext.data_extracao ? new Date(ext.data_extracao) : null;
                if (!rawDate) return;

                const extDateStr = rawDate.toISOString().split('T')[0];
                const price = ext.preco_por_noite || (ext.preco_total && ext.quantidade_noites ? ext.preco_total / ext.quantidade_noites : 0);
                if (price <= 0) return;

                if (!historyMap.has(extDateStr)) {
                    historyMap.set(extDateStr, { sum: 0, count: 0, items: [] });
                }
                const entry = historyMap.get(extDateStr)!;
                entry.sum += price;
                entry.count += 1;
                entry.items.push({ id: item.id, name: item.name, price });
            });
        });

        const history = Array.from(historyMap.entries())
            .map(([extDate, val]) => ({
                date: extDate,
                value: val.count > 0 ? val.sum / val.count : 0,
                items: val.items
            }))
            .filter(item => item.value > 0)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setCompositionDialog({
            open: true,
            date,
            avgPrice,
            items,
            history
        });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 bg-muted/10 rounded-xl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground animate-pulse">Consultando mercado para {unitName}...</p>
            </div>
        )
    }

    if (fetchError) {
        return (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center">
                <p className="text-sm">Erro ao buscar dados do Supabase.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
                <div className="space-y-1">
                    <h4 className="text-sm font-bold uppercase text-primary">Concorrentes no Raio</h4>
                    <p className="text-xs text-muted-foreground">Filtro automático baseado em {unitName}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mr-1">
                        <Badge variant="outline" className="text-[10px]"><Users className="h-3 w-3 mr-1" /> {isLargeProperty ? "9+ hóspedes" : `${guestsMin}-${guestsMax}`}</Badge>
                        <Badge variant="outline" className="text-[10px]"><CalendarIcon className="h-3 w-3 mr-1" /> {startDate.split('-').reverse().join('/')} - {endDate.split('-').reverse().join('/')}</Badge>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between bg-muted/20 p-3 rounded-lg border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>Ao redor da propriedade</span>
                </div>
                <div className="w-32">
                    <Select value={radius} onValueChange={setRadius}>
                        <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue placeholder="Raio" />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                            <SelectItem value="2">2 km</SelectItem>
                            <SelectItem value="5">5 km</SelectItem>
                            <SelectItem value="10">10 km</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <MarketKPICards
                averagePrice={averagePrice}
                medianPrice={medianPrice}
                totalCompetitors={competitors.length}
                averageRating={averageRating}
                averageGuests={averageGuests}
            />

            {stats.length > 0 ? (
                <div className="mt-4 border rounded-xl p-4 bg-background">
                    <PriceEvolutionChart
                        data={stats}
                        competitorMap={competitorMap}
                        onPointClick={handlePointClick}
                    />
                </div>
            ) : (
                <div className="p-8 bg-muted/30 rounded-xl border border-dashed text-center">
                    <p className="text-sm text-muted-foreground">Poucos dados encontrados neste período específico para renderizar a curva de preço histórico.</p>
                </div>
            )}

            <DailyCompositionDialog
                open={compositionDialog.open}
                onOpenChange={(open) => setCompositionDialog(prev => ({ ...prev, open }))}
                date={compositionDialog.date}
                avgPrice={compositionDialog.avgPrice}
                items={compositionDialog.items}
                history={compositionDialog.history}
            />
        </div>
    )
}
