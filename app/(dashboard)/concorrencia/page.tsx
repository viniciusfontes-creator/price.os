'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarketKPICards } from '@/components/competitor-kpi-cards'
import { PriceEvolutionChart } from '@/components/price-evolution-chart'
import { DailyCompositionDialog } from '@/components/market-monitor/daily-composition-dialog'
import { LocationSelector } from '@/components/location-selector'
import { calculateMedian } from '@/lib/competitor-utils'
import { MapPin, Loader2, ExternalLink, Search, Users, Star, Calendar as CalendarIcon, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { InitialLoadingScreen } from '@/components/page-skeleton'
import { useChartLoading, useAutoCompleteChart } from '@/hooks/use-chart-loading'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface Competitor {
    id: number | string
    id_numerica?: string
    data_extracao: string
    checkin_formatado: string
    tipo_propriedade: string
    nome_anuncio: string
    preco_total: number
    quantidade_noites: number
    preco_por_noite: number
    latitude: number
    longitude: number
    hospedes_adultos: number
    media_avaliacao: string
    preferido_hospedes: boolean
    url_anuncio: string
    distancia_km?: number
}

interface ChartData {
    date: string
    avgPrice: number
    [key: string]: any
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || ''

export default function ConcorrenciaPage() {
    // Filters
    const [locationLabel, setLocationLabel] = useState('João Pessoa, PB, Brasil')
    const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>({ lat: -7.1195, lng: -34.8450 }) // Default JP
    const [searchQuery, setSearchQuery] = useState<string | null>(null)

    const [radius, setRadius] = useState('10')
    const [guestsMin, setGuestsMin] = useState(1)
    const [guestsMax, setGuestsMax] = useState(20)
    const [startDate, setStartDate] = useState<string>('2026-01-01')
    const [endDate, setEndDate] = useState<string>('2026-12-31')

    // UI Local Filters
    const [searchTerm, setSearchTerm] = useState('')

    // Dialog State
    const [compositionDialog, setCompositionDialog] = useState<{
        open: boolean;
        date: Date | null;
        avgPrice: number;
        items: any[];
        history: any[];
    }>({
        open: false,
        date: null,
        avgPrice: 0,
        items: [],
        history: []
    });

    // Fetching state
    const [isFirstLoad, setIsFirstLoad] = useState(true)

    // Chart loading tracking
    const { progress: chartProgress, isLoading: chartsLoading, registerChart, completeChart } = useChartLoading()

    const queryParams = useMemo(() => {
        const params = new URLSearchParams({
            radius,
            guestsMin: guestsMin.toString(),
            guestsMax: guestsMax.toString(),
            startDate,
            endDate,
            includeStats: 'true',
            limit: '1000'
        })

        if (selectedCoords && !searchQuery) {
            params.append('lat', selectedCoords.lat.toString())
            params.append('lon', selectedCoords.lng.toString())
        } else if (searchQuery) {
            params.append('location', searchQuery)
        } else {
            params.append('location', locationLabel)
        }
        return params.toString()
    }, [selectedCoords, searchQuery, radius, guestsMin, guestsMax, startDate, endDate, locationLabel])

    const { data: result, error: fetchError, isLoading, isValidating, mutate } = useSWR<{ success: boolean, data: Competitor[], stats: ChartData[] }>(
        `/api/competitors?${queryParams}`,
        fetcher,
        {
            revalidateOnFocus: false,
            keepPreviousData: true,
            onSuccess: () => setIsFirstLoad(false)
        }
    )

    const competitors: Competitor[] = result?.success ? result.data || [] : []
    const stats: ChartData[] = result?.success ? result.stats || [] : []
    const loading = isLoading || (!result && !fetchError)

    // Register charts for loading tracking
    useEffect(() => {
        registerChart('competitors-data')
        registerChart('stats-chart')
    }, [registerChart])

    // Auto-complete charts when data is ready
    useAutoCompleteChart('competitors-data', !isLoading && competitors.length >= 0, registerChart, completeChart)
    useAutoCompleteChart('stats-chart', !isLoading && stats.length >= 0, registerChart, completeChart)

    const handleLocationSelect = (loc: { address: string; lat: number; lng: number } | null, text?: string) => {
        if (loc) {
            setLocationLabel(loc.address)
            setSelectedCoords({ lat: loc.lat, lng: loc.lng })
            setSearchQuery(null)
        } else if (text) {
            setLocationLabel(text)
            setSearchQuery(text)
            setSelectedCoords(null)
        }
    }

    // Filter local list by search term
    const filteredCompetitors = competitors.filter((c: Competitor) =>
        c.nome_anuncio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.tipo_propriedade?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Calculate Market KPIs
    const pricesPerNight = filteredCompetitors.map((c: Competitor) => c.preco_por_noite).filter((p: number) => p > 0)
    const averagePrice = pricesPerNight.length > 0
        ? pricesPerNight.reduce((a: number, b: number) => a + b, 0) / pricesPerNight.length
        : 0
    const medianPrice = calculateMedian(pricesPerNight)
    const ratings = filteredCompetitors
        .map((c: Competitor) => parseFloat(c.media_avaliacao || '0'))
        .filter((r: number) => !isNaN(r))
    const averageRating = ratings.length > 0
        ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
        : 0

    const averageGuests = filteredCompetitors.length > 0
        ? filteredCompetitors.reduce((a: number, b: Competitor) => a + (b.hospedes_adultos || 0), 0) / filteredCompetitors.length
        : 0

    const competitorMap = useMemo(() => {
        const map: Record<string, string> = {}
        competitors.forEach(c => {
            if (c.id_numerica) map[c.id_numerica.toString()] = c.nome_anuncio
            if (c.id) map[c.id.toString()] = c.nome_anuncio
        })
        return map
    }, [competitors])

    const handlePointClick = (payload: any) => {
        const date = new Date(payload.date);
        const avgPrice = payload.avgPrice;

        // Items composition
        const items = Object.keys(payload)
            .filter(k => k.startsWith('listing_'))
            .map(k => {
                const id = k.replace('listing_', '');
                // Find full data in the main competitors list if possible (might overlap)
                // Note: The competitors list might contain different check-in dates, so we need to be careful.
                // Actually, the `stats` array comes from aggregations which might not have full details of every point readily available in `competitors` if `competitors` doesn't cover that specific date (though usually it covers the range).
                // Let's try to find metadata if available.

                // Extract Airbnb ID safely
                const idString = id.toString();
                const found = competitors.find(c => {
                    const idNum = c.id_numerica ? c.id_numerica.toString() : '';
                    const cId = c.id ? c.id.toString() : '';
                    return idNum === idString || cId === idString || (c as any)._extracted_airbnb_id === idString;
                });

                return {
                    id: idString,
                    name: found?.nome_anuncio || competitorMap[idString] || `Anúncio ${idString}`,
                    price: payload[k],
                    fullData: found ? { airbnb_data: found, history: (found as any).history, ...found } : null
                }
            })
            .sort((a, b) => b.price - a.price);

        // History logic: Calculate market average evolution for THIS check-in date
        const historyMap = new Map<string, { sum: number; count: number; items: any[] }>();
        const checkinStr = date.toISOString().split('T')[0];

        items.forEach(item => {
            const historyData = item.fullData?.history || [];

            // Filter extractions for THIS check-in date
            const extractionsForCheckin = historyData.filter((h: any) =>
                h.checkin_formatado && h.checkin_formatado.startsWith(checkinStr)
            );

            extractionsForCheckin.forEach((ext: any) => {
                const rawDate = ext.data_extracao ? new Date(ext.data_extracao) : null;
                if (!rawDate) return;

                // Truncate to YYYY-MM-DD so all extractions from same day merge into one point
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

    if (isFirstLoad && (loading || chartsLoading)) {
        return <InitialLoadingScreen externalProgress={chartProgress} onComplete={() => setIsFirstLoad(false)} />
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Análise de Concorrentes - Shortstay</h1>
                    <div className="flex items-center gap-3">
                        <p className="text-muted-foreground font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            {locationLabel || 'João Pessoa'} {searchQuery ? '(Busca por texto)' : '(Geolocalizado)'}
                        </p>
                        {isValidating && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    </div>
                </div>
            </div>

            <Card className="border-none bg-muted/20 shadow-sm">
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground ml-1 flex items-center gap-2">
                                Localização (Google Maps)
                                {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                            </label>
                            <LocationSelector
                                apiKey={GOOGLE_MAPS_API_KEY}
                                onLocationSelect={handleLocationSelect}
                                defaultValue={locationLabel}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Raio da Busca</label>
                            <Select value={radius} onValueChange={setRadius}>
                                <SelectTrigger className="bg-background h-10 border-muted-foreground/20">
                                    <SelectValue placeholder="Raio" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2">2 km</SelectItem>
                                    <SelectItem value="5">5 km</SelectItem>
                                    <SelectItem value="10">10 km</SelectItem>
                                    <SelectItem value="25">25 km</SelectItem>
                                    <SelectItem value="50">50 km</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground ml-1">
                                Hóspedes ({guestsMin} – {guestsMax})
                            </label>
                            <div className="bg-background rounded-lg border border-muted-foreground/20 h-10 flex items-center px-3">
                                <Slider
                                    min={1}
                                    max={20}
                                    step={1}
                                    value={[guestsMin, guestsMax]}
                                    onValueChange={([min, max]) => {
                                        setGuestsMin(min)
                                        setGuestsMax(max)
                                    }}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Data Início</label>
                            <div className="flex items-center gap-2 bg-background p-1 px-3 rounded-lg border border-muted-foreground/20 h-10 overflow-hidden">
                                <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                                <input
                                    type="date"
                                    className="bg-transparent border-none text-xs focus:outline-none w-full"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Data Fim</label>
                            <div className="flex items-center gap-2 bg-background p-1 px-3 rounded-lg border border-muted-foreground/20 h-10 overflow-hidden">
                                <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                                <input
                                    type="date"
                                    className="bg-transparent border-none text-xs focus:outline-none w-full"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <MarketKPICards
                averagePrice={averagePrice}
                medianPrice={medianPrice}
                totalCompetitors={filteredCompetitors.length}
                averageRating={averageRating}
                averageGuests={averageGuests}
            />

            <div className="grid grid-cols-1 gap-6">
                <PriceEvolutionChart
                    data={stats}
                    competitorMap={competitorMap}
                    onPointClick={handlePointClick}
                />
            </div>

            <DailyCompositionDialog
                open={compositionDialog.open}
                onOpenChange={(open) => setCompositionDialog(prev => ({ ...prev, open }))}
                date={compositionDialog.date}
                avgPrice={compositionDialog.avgPrice}
                items={compositionDialog.items}
                history={compositionDialog.history}
            />

            <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">Anúncios Identificados</CardTitle>
                            <CardDescription>
                                {locationLabel?.split(',')[0]} | {filteredCompetitors.length} anúncios {selectedCoords ? 'geograficamente próximos' : 'encontrados'}
                            </CardDescription>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Filtrar por nome..."
                                className="pl-9 h-9 border-muted-foreground/20"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-muted-foreground animate-pulse">
                                {selectedCoords ? 'Processando coordenadas no Supabase...' : 'Realizando busca por texto...'}
                            </p>
                        </div>
                    ) : filteredCompetitors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-2">
                            <p className="text-lg font-medium">Nenhum dado encontrado para "{locationLabel}"</p>
                            <p className="text-muted-foreground text-sm">
                                {selectedCoords ? `Tente ampliar o raio de busca (${radius}km) ou mudar a localização.` : 'Tente usar o autocomplete do Google Maps ou digitar outro termo.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/10 border-b-0">
                                        <TableHead className="w-[35%] py-4">Anúncio</TableHead>
                                        <TableHead className="py-4">Check-in</TableHead>
                                        <TableHead className="py-4">Capacidade</TableHead>
                                        <TableHead className="py-4">Distância</TableHead>
                                        <TableHead className="py-4">Avaliação</TableHead>
                                        <TableHead className="text-right py-4 font-bold text-primary">Preço/Noite</TableHead>
                                        <TableHead className="text-right py-4">Link</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCompetitors.map((competitor: Competitor) => (
                                        <TableRow key={competitor.id} className="hover:bg-muted/30 transition-colors border-b-muted/20">
                                            <TableCell className="py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm leading-tight mb-1 truncate max-w-[300px]" title={competitor.nome_anuncio}>
                                                        {competitor.nome_anuncio}
                                                    </span>
                                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                        <MapPin className="h-3 w-3" />
                                                        {competitor.tipo_propriedade}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <span className="text-xs font-mono">
                                                    {new Date(competitor.checkin_formatado).toLocaleDateString('pt-BR')}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Users className="h-3 w-3 text-muted-foreground" />
                                                    {competitor.hospedes_adultos}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Badge variant="outline" className="text-[10px] font-mono">
                                                    {competitor.distancia_km ? `${competitor.distancia_km.toFixed(1)} km` : 'N/A'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex items-center gap-1">
                                                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                                    <span className="font-medium text-sm">{competitor.media_avaliacao || 'N/A'}</span>
                                                    {competitor.preferido_hospedes && (
                                                        <Badge variant="secondary" className="text-[9px] h-4 py-0 px-1 bg-purple-100 text-purple-700">
                                                            Fav
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-4">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold text-sm text-primary">
                                                        R$ {competitor.preco_por_noite.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        Total R$ {competitor.preco_total?.toLocaleString('pt-BR')} ({competitor.quantidade_noites}n)
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-4">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" asChild>
                                                    <a href={competitor.url_anuncio} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
