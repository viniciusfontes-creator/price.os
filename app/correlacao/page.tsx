'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Search, MapPin, Target, Calendar as CalendarIcon, TrendingUp, Filter, History, ChevronDown, Info, Plus, ExternalLink, Trash, RefreshCw, Pencil, Users, Home, X, SlidersHorizontal, Building2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { InitialLoadingScreen } from '@/components/page-skeleton';

const fetcher = (url: string) => fetch(url).then(res => res.json());
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { Calendar } from "@/components/ui/calendar";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,

} from "@/components/ui/popover";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { CreateBasketDialog } from '@/components/market-monitor/create-basket-dialog';
import { AddItemDialog } from '@/components/market-monitor/add-item-dialog';
import { BasketDetailsDialog } from '@/components/market-monitor/basket-details-dialog';
import { DailyCompositionDialog } from '@/components/market-monitor/daily-composition-dialog';
import { MarketKPICards } from '@/components/competitor-kpi-cards';
import { PriceEvolutionChart } from '@/components/price-evolution-chart';
import { CompetitorDetailsDialog } from '@/components/market-monitor/competitor-details-dialog';
import { BasketManagementView } from '@/components/market-monitor/basket-management-view';
import { EditBasketDialog } from '@/components/market-monitor/edit-basket-dialog';
import { calculateMedian } from '@/lib/competitor-utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Property {
    idpropriedade: string;
    nome: string;
    propertyKey: string;
    quantidade_quartos: string;
    latitude?: number;
    longitude?: number;
    praca?: string;
    cidade?: string;
    valor_tarifario?: number;
}

interface Competitor {
    id: number;
    nome_anuncio: string;
    tipo_propriedade: string;
    preco_por_noite: number;
    media_avaliacao: string;
    hospedes_adultos: number;
    url_anuncio: string;
}

interface Basket {
    id: string;
    name: string;
    location?: string;
    guest_capacity?: number;
    internal_property_id: string;
    basket_items?: BasketItem[];
}

interface BasketItem {
    id: string;
    basket_id: string;
    item_type: string;
    internal_property_id?: string;
    airbnb_listing_id?: string;
    is_primary: boolean;
    airbnb_data?: Competitor;
    internal_property_data?: Property;
    history?: any[];
}

type ChartMode = 'checkin' | 'extraction';

export default function MarketMonitorPage() {
    const [selectedBasket, setSelectedBasket] = useState<Basket | null>(null);
    const [properties, setProperties] = useState<Property[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const searchParams = useSearchParams();
    const [createBasketOpen, setCreateBasketOpen] = useState(false);

    // Check for addBasket param
    useEffect(() => {
        if (searchParams.get('addBasket') === 'true') {
            setCreateBasketOpen(true);
        }

        // Check for propertyId param to auto-filter
        const propertyIdParam = searchParams.get('propertyId');
        if (propertyIdParam) {
            setFilterPropertyId(propertyIdParam);
        }
    }, [searchParams]);

    // Advanced Filters
    const [filterPropertyId, setFilterPropertyId] = useState<string>('all');
    const [filterGuestCapacity, setFilterGuestCapacity] = useState<string>('all');
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Filters
    const [checkinDateRange, setCheckinDateRange] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(new Date().setDate(new Date().getDate() + 90))
    });
    const [extractionDateRange, setExtractionDateRange] = useState<DateRange | undefined>();
    const [chartMode, setChartMode] = useState<ChartMode>('checkin');

    // Trigger reload
    const [compositionDialog, setCompositionDialog] = useState<{
        open: boolean;
        date: Date | null;
        avgPrice: number;
        items?: any[];
        history?: any[];
        competitors?: any[];
    }>({
        open: false,
        date: null,
        avgPrice: 0,
        items: [],
        history: [],
        competitors: []
    });

    const { toast } = useToast();

    // Load Properties (for dialogs)
    useEffect(() => {
        async function loadProperties() {
            try {
                const res = await fetch('/api/properties');
                const result = await res.json();
                if (result.success) setProperties(result.data);
            } catch (err) {
                console.error(err);
            }
        }
        loadProperties();
    }, []);

    // Baskets Fetching with SWR
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    const queryParams = useMemo(() => {
        const params = new URLSearchParams();
        if (checkinDateRange?.from) {
            params.append('startDate', checkinDateRange.from.toISOString().split('T')[0]);
        }
        if (checkinDateRange?.to) {
            params.append('endDate', checkinDateRange.to.toISOString().split('T')[0]);
        } else if (checkinDateRange?.from) {
            params.append('endDate', checkinDateRange.from.toISOString().split('T')[0]);
        }
        return params.toString();
    }, [checkinDateRange]);

    const { data: basketResponse, isLoading: basketsLoading, isValidating: basketsValidating, mutate: mutateBaskets } = useSWR<{ success: boolean, data: Basket[] }>(
        `/api/baskets?${queryParams}`,
        fetcher,
        {
            revalidateOnFocus: false,
            keepPreviousData: true,
            onSuccess: () => setIsFirstLoad(false)
        }
    );

    const activeBaskets = basketResponse?.success ? basketResponse.data : [];

    // Sync selected basket when data changes
    useEffect(() => {
        if (activeBaskets.length > 0) {
            if (selectedBasket) {
                const current = activeBaskets.find((b: any) => b.id === selectedBasket.id);
                if (current) setSelectedBasket(current);
            } else {
                setSelectedBasket(activeBaskets[0]);
            }
        }
    }, [activeBaskets]);

    const chartData = useMemo(() => {
        if (!selectedBasket) return [];

        const dataPoints: Record<string, { date: string, isoDate: string, [key: string]: any }> = {};

        // Use only selectedBasket instead of all baskets
        [selectedBasket].forEach(basket => {
            basket.basket_items?.forEach(item => {
                const itemKey = item.airbnb_listing_id || item.id;

                item.history?.forEach((h: any) => {
                    const checkinDateStr = h.checkin_formatado?.toString().split('T')[0];
                    const extractionDateStr = h.data_extracao ? h.data_extracao.toString().split('T')[0] : 'Unknown';

                    if (!checkinDateStr) return;

                    const checkinDate = new Date(checkinDateStr);
                    const extractionDate = extractionDateStr !== 'Unknown' ? new Date(extractionDateStr) : new Date();

                    // 1. Client-Side Filtering (Extra safety + Extraction Filter)

                    // Checkin Filter (Redundant if API works, but safe)
                    if (checkinDateRange?.from) {
                        const from = new Date(checkinDateRange.from);
                        from.setHours(0, 0, 0, 0);
                        if (checkinDate < from) return;
                    }
                    if (checkinDateRange?.to) {
                        const to = new Date(checkinDateRange.to);
                        to.setHours(23, 59, 59, 999);
                        if (checkinDate > to) return;
                    } else if (checkinDateRange?.from) {
                        const from = new Date(checkinDateRange.from);
                        from.setHours(23, 59, 59, 999);
                        if (checkinDate > from) return;
                    }

                    // Extraction Filter
                    if (extractionDateRange?.from) {
                        const from = new Date(extractionDateRange.from);
                        from.setHours(0, 0, 0, 0);
                        if (extractionDate < from) return;
                    }
                    if (extractionDateRange?.to) {
                        const to = new Date(extractionDateRange.to);
                        to.setHours(23, 59, 59, 999);
                        if (extractionDate > to) return;
                    }

                    let xAxisKey = '';
                    let value = h.preco_por_noite;
                    if (!value && h.preco_total && h.quantidade_noites) {
                        value = parseFloat((h.preco_total / h.quantidade_noites).toFixed(2));
                    }
                    if (!value) return;

                    if (chartMode === 'checkin') {
                        xAxisKey = checkinDateStr;
                        if (!dataPoints[xAxisKey]) {
                            dataPoints[xAxisKey] = { date: xAxisKey, isoDate: xAxisKey };
                        }
                        // LATEST extraction logic
                        const currentStored = dataPoints[xAxisKey][`meta_${itemKey}`];
                        if (!currentStored || new Date(currentStored.extraction) < extractionDate) {
                            dataPoints[xAxisKey][`listing_${itemKey}`] = value;
                            dataPoints[xAxisKey][`meta_${itemKey}`] = { extraction: extractionDateStr };
                        }
                    } else {
                        xAxisKey = extractionDateStr;
                        if (!dataPoints[xAxisKey]) {
                            dataPoints[xAxisKey] = { date: xAxisKey, isoDate: xAxisKey };
                        }
                        // AVG logic
                        if (!dataPoints[xAxisKey][`acc_${itemKey}`]) {
                            dataPoints[xAxisKey][`acc_${itemKey}`] = { sum: 0, count: 0 };
                        }
                        dataPoints[xAxisKey][`acc_${itemKey}`].sum += value;
                        dataPoints[xAxisKey][`acc_${itemKey}`].count += 1;
                    }
                });
            });
        });

        // Finalize Averages for Extraction Mode
        if (chartMode === 'extraction') {
            Object.keys(dataPoints).forEach(key => {
                const point = dataPoints[key];
                Object.keys(point).forEach(prop => {
                    if (prop.startsWith('acc_')) {
                        const itemKey = prop.replace('acc_', '');
                        const { sum, count } = point[prop];
                        point[`listing_${itemKey}`] = parseFloat((sum / count).toFixed(2));
                    }
                });
            });
        }

        return Object.values(dataPoints).sort((a, b) => a.isoDate.localeCompare(b.isoDate));
    }, [activeBaskets, selectedBasket, checkinDateRange, extractionDateRange, chartMode]);

    // Calculate Aggregated Chart Data (Merging Average into Rich Data)
    const richChartData = useMemo(() => {
        return chartData.map(point => {
            const values: number[] = [];
            Object.keys(point).forEach(k => {
                if (k.startsWith('listing_')) values.push(point[k]);
            });
            const avg = values.length > 0
                ? values.reduce((a, b) => a + b, 0) / values.length
                : 0;

            // Return point spread + avgPrice
            return {
                ...point,
                avgPrice: avg
            };
        });
    }, [chartData]);

    const competitorMap = useMemo(() => {
        const map: Record<string, string> = {};
        activeBaskets.forEach((b: Basket) => {
            b.basket_items?.forEach((i: BasketItem) => {
                const id = i.airbnb_listing_id || i.id;
                if (i.airbnb_data?.nome_anuncio) {
                    map[id] = i.airbnb_data.nome_anuncio;
                }
            })
        });
        return map;
    }, [activeBaskets]);

    // Calculate Market KPIs from Chart Data (Visible Period)
    const marketKPIs = useMemo(() => {
        let allPrices: number[] = [];

        // Collect all daily prices from the chart period
        // This gives a weighted average based on exposure (days available)
        richChartData.forEach(point => {
            Object.keys(point).forEach(k => {
                if (k.startsWith('listing_')) allPrices.push((point as any)[k]);
            });
        });

        const avgPrice = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 0;
        const median = calculateMedian(allPrices);

        // Count unique competitors in activeBaskets for "Total Anúncios"
        let count = 0;
        let ratings: number[] = [];
        let guestsSum = 0;
        let guestsCount = 0;

        if (selectedBasket) {
            selectedBasket.basket_items?.forEach(i => {
                if (i.airbnb_data) {
                    count++;
                    if (i.airbnb_data.media_avaliacao) {
                        const r = parseFloat(i.airbnb_data.media_avaliacao);
                        if (!isNaN(r)) ratings.push(r);
                    }
                    if (i.airbnb_data.hospedes_adultos) {
                        guestsSum += i.airbnb_data.hospedes_adultos;
                        guestsCount++;
                    }
                }
            })
        }
        const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        const avgGuests = guestsCount > 0 ? guestsSum / guestsCount : 0;

        return {
            averagePrice: avgPrice,
            medianPrice: median,
            totalCompetitors: count,
            averageRating: avgRating,
            averageGuests: avgGuests
        };
    }, [richChartData, activeBaskets, selectedBasket]);

    const handlePointClick = (payload: any) => {
        const date = new Date(payload.date);
        const dateStr = payload.isoDate || payload.date; // Use string format YYYY-MM-DD
        const avgPrice = payload.avgPrice;

        // 1. Calculate History: Evolution of Avg Price for this Checkin Date across extraction dates
        const historyMap: Record<string, { sum: number, count: number, items: any[] }> = {};

        if (selectedBasket) {
            [selectedBasket].forEach((basket: Basket) => {
                basket.basket_items?.forEach((item: BasketItem) => {
                    item.history?.forEach((h: any) => {
                        // We match ONLY the checkin date
                        const hCheckin = h.checkin_formatado?.toString().split('T')[0];
                        if (hCheckin === dateStr) {
                            // Extract date part YYYY-MM-DD
                            let extraction = 'Unknown';
                            if (h.data_extracao) {
                                // Handle ISO string or Date object safely
                                extraction = h.data_extracao.toString().substring(0, 10);
                            }

                            if (extraction !== 'Unknown') {
                                if (!historyMap[extraction]) historyMap[extraction] = { sum: 0, count: 0, items: [] };

                                const itemId = item.airbnb_listing_id || item.id;
                                // Check if this item is already in the items list for this extraction date
                                const isDuplicate = historyMap[extraction].items.some((i: any) => i.id === itemId);

                                if (!isDuplicate) {
                                    let val = h.preco_por_noite;
                                    if (!val && h.preco_total && h.quantidade_noites) val = h.preco_total / h.quantidade_noites;
                                    if (val) {
                                        historyMap[extraction].sum += val;
                                        historyMap[extraction].count += 1;
                                        historyMap[extraction].items.push({
                                            id: itemId,
                                            name: item.airbnb_data?.nome_anuncio || `Anúncio ${itemId}`,
                                            price: val
                                        });
                                    }
                                }
                            }
                        }
                    });
                });
            });
        }

        const history = Object.keys(historyMap).map(d => ({
            date: d,
            value: historyMap[d].sum / historyMap[d].count,
            items: historyMap[d].items.sort((a, b) => b.price - a.price)
        })).sort((a, b) => a.date.localeCompare(b.date));

        const items = Object.keys(payload)
            .filter(k => k.startsWith('listing_'))
            .map(k => {
                const id = k.replace('listing_', '');
                // Find full data
                let fullData = null;
                for (const b of activeBaskets) {
                    const found = b.basket_items?.find((i: BasketItem) => (i.airbnb_listing_id || i.id).toString() === id.toString());
                    if (found) { fullData = found; break; }
                }

                return {
                    id,
                    name: competitorMap[id] || `Anúncio ${id}`,
                    price: payload[k],
                    fullData
                }
            })
            .sort((a, b) => b.price - a.price);

        setCompositionDialog({
            open: true,
            date,
            avgPrice,
            items,
            history
        });
    };

    // Get unique properties that have activeBaskets
    const propertiesWithBaskets = useMemo(() => {
        const propIds = new Set<string>();
        activeBaskets.forEach(b => {
            b.basket_items?.forEach(item => {
                if (item.item_type === 'internal' && item.internal_property_id) {
                    propIds.add(item.internal_property_id);
                }
            });
        });
        return properties.filter(p => propIds.has(p.idpropriedade));
    }, [activeBaskets, properties]);

    // Get unique guest capacities from activeBaskets
    const uniqueGuestCapacities = useMemo(() => {
        const capacities = new Set<number>();
        activeBaskets.forEach(b => {
            if (b.guest_capacity) capacities.add(b.guest_capacity);
        });
        return Array.from(capacities).sort((a, b) => a - b);
    }, [activeBaskets]);

    // Advanced filtering logic
    const filteredBaskets = useMemo(() => {
        return activeBaskets.filter(b => {
            // Text search (name or location)
            const matchesSearch = !searchTerm ||
                b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.location?.toLowerCase().includes(searchTerm.toLowerCase());

            // Property filter
            const matchesProperty = filterPropertyId === 'all' ||
                b.basket_items?.some(item =>
                    item.item_type === 'internal' && item.internal_property_id === filterPropertyId
                );

            // Guest capacity filter
            const matchesCapacity = filterGuestCapacity === 'all' ||
                b.guest_capacity?.toString() === filterGuestCapacity;

            return matchesSearch && matchesProperty && matchesCapacity;
        });
    }, [activeBaskets, searchTerm, filterPropertyId, filterGuestCapacity]);

    // Count active filters
    const activeFiltersCount = [filterPropertyId !== 'all', filterGuestCapacity !== 'all'].filter(Boolean).length;

    if (isFirstLoad && basketsLoading) {
        return <InitialLoadingScreen />;
    }

    return (
        <TooltipProvider>
            <div className="container mx-auto px-3 py-4 sm:p-4 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl">
                <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                <TrendingUp className="w-3 h-3 mr-1" /> Beta
                            </Badge>
                            {basketsValidating && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight">Monitor de Mercado</h1>
                        <p className="text-muted-foreground">Acompanhe a flutuação de preços dos concorrentes.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => mutateBaskets()}
                            disabled={basketsValidating}
                        >
                            <RefreshCw className={cn("h-4 w-4", basketsValidating && "animate-spin")} />
                            Atualizar
                        </Button>
                        <CreateBasketDialog
                            onSuccess={() => mutateBaskets()}
                            properties={properties}
                            enableAISuggestions={true}
                            open={createBasketOpen}
                            onOpenChange={setCreateBasketOpen}
                            propertyId={searchParams.get('propertyId') || undefined}
                            propertyName={searchParams.get('propertyName') || undefined}
                        />
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Sidebar - Baskets List */}
                    <div className="lg:col-span-3 space-y-4">
                        <Card className="border-none shadow-md bg-card ring-1 ring-border/50">
                            <CardHeader className="p-4 bg-muted/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                        Minhas Cestas
                                    </CardTitle>
                                    <Badge variant="secondary" className="text-xs">
                                        {filteredBaskets.length} de {activeBaskets.length}
                                    </Badge>
                                </div>

                                {/* Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por nome ou localização..."
                                        className="pl-9 h-10 bg-background/80 pr-8"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Advanced Filters Toggle */}
                                <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                                    <CollapsibleTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-between h-8 text-xs"
                                        >
                                            <span className="flex items-center gap-2">
                                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                                Filtros Avançados
                                                {activeFiltersCount > 0 && (
                                                    <Badge variant="default" className="h-4 px-1.5 text-[10px]">
                                                        {activeFiltersCount}
                                                    </Badge>
                                                )}
                                            </span>
                                            <ChevronDown className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")} />
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-3 pt-3">
                                        {/* Filter by Property */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                                <Building2 className="h-3 w-3" />
                                                Propriedade Interna
                                            </label>
                                            <Select value={filterPropertyId} onValueChange={setFilterPropertyId}>
                                                <SelectTrigger className="h-9 text-xs">
                                                    <SelectValue placeholder="Todas as propriedades" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Todas as propriedades</SelectItem>
                                                    {propertiesWithBaskets.map(prop => (
                                                        <SelectItem key={prop.idpropriedade} value={prop.idpropriedade}>
                                                            <span className="truncate max-w-[180px] block">{prop.nome}</span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Filter by Guest Capacity */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                                <Users className="h-3 w-3" />
                                                Capacidade de Hóspedes
                                            </label>
                                            <Select value={filterGuestCapacity} onValueChange={setFilterGuestCapacity}>
                                                <SelectTrigger className="h-9 text-xs">
                                                    <SelectValue placeholder="Qualquer capacidade" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Qualquer capacidade</SelectItem>
                                                    {uniqueGuestCapacities.map(cap => (
                                                        <SelectItem key={cap} value={cap.toString()}>
                                                            {cap} hóspede{cap > 1 ? 's' : ''}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Clear Filters */}
                                        {activeFiltersCount > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full h-8 text-xs text-muted-foreground hover:text-destructive"
                                                onClick={() => {
                                                    setFilterPropertyId('all');
                                                    setFilterGuestCapacity('all');
                                                }}
                                            >
                                                <X className="h-3 w-3 mr-1" />
                                                Limpar filtros
                                            </Button>
                                        )}
                                    </CollapsibleContent>
                                </Collapsible>
                            </CardHeader>

                            <CardContent className="p-0 max-h-[350px] sm:max-h-[450px] lg:max-h-[550px] overflow-y-auto custom-scrollbar">
                                {basketsLoading ? (
                                    <div className="flex flex-col items-center justify-center p-12 gap-3">
                                        <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                        <span className="text-xs text-muted-foreground">Carregando cestas...</span>
                                    </div>
                                ) : filteredBaskets.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
                                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                                            <Search className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium text-muted-foreground">
                                            {searchTerm || activeFiltersCount > 0
                                                ? 'Nenhuma cesta encontrada'
                                                : 'Nenhuma cesta criada ainda'}
                                        </p>
                                        <p className="text-xs text-muted-foreground/70">
                                            {searchTerm || activeFiltersCount > 0
                                                ? 'Tente ajustar os filtros de busca'
                                                : 'Clique em "Nova Cesta" para começar'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col divide-y divide-border/30">
                                        {filteredBaskets.map(basket => {
                                            const internalCount = basket.basket_items?.filter(i => i.item_type === 'internal').length || 0;
                                            const externalCount = basket.basket_items?.filter(i => i.item_type === 'external').length || 0;
                                            const isSelected = selectedBasket?.id === basket.id;

                                            // Get first internal property name for context
                                            const firstInternalProperty = basket.basket_items?.find(i => i.item_type === 'internal')?.internal_property_data;

                                            return (
                                                <button
                                                    key={basket.id}
                                                    onClick={() => setSelectedBasket(basket)}
                                                    className={cn(
                                                        "flex flex-col p-4 text-left transition-all hover:bg-primary/5 group",
                                                        isSelected && "bg-primary/10 border-l-4 border-l-primary"
                                                    )}
                                                >
                                                    {/* Basket Name */}
                                                    <span className={cn(
                                                        "font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors",
                                                        isSelected && "text-primary"
                                                    )}>
                                                        {basket.name}
                                                    </span>

                                                    {/* Location & Guests Row */}
                                                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                                        {basket.location && (
                                                            <div className="flex items-center gap-1">
                                                                <MapPin className="h-3 w-3" />
                                                                <span className="truncate max-w-[100px]">{basket.location}</span>
                                                            </div>
                                                        )}
                                                        {basket.guest_capacity && (
                                                            <div className="flex items-center gap-1">
                                                                <Users className="h-3 w-3" />
                                                                <span>{basket.guest_capacity} hósp.</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Internal Property Preview */}
                                                    {firstInternalProperty && (
                                                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground/70">
                                                            <Home className="h-3 w-3" />
                                                            <span className="truncate">{firstInternalProperty.nome}</span>
                                                        </div>
                                                    )}

                                                    {/* Counts Badges - Scrollable on mobile */}
                                                    <div className="flex items-center gap-2 mt-2.5 overflow-x-auto pb-1">
                                                        <Badge
                                                            variant="secondary"
                                                            className={cn(
                                                                "text-[10px] h-5 gap-1",
                                                                internalCount > 0 && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                            )}
                                                        >
                                                            <Home className="h-2.5 w-2.5" />
                                                            {internalCount} interna{internalCount !== 1 ? 's' : ''}
                                                        </Badge>
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-[10px] h-5 gap-1",
                                                                externalCount > 0 && "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800"
                                                            )}
                                                        >
                                                            <Target className="h-2.5 w-2.5" />
                                                            {externalCount} externa{externalCount !== 1 ? 's' : ''}
                                                        </Badge>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-9 space-y-6">
                        {selectedBasket ? (
                            <>
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-bold">{selectedBasket.name}</h2>
                                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                                            {selectedBasket.location && (
                                                <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                                                    <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
                                                    <span className="truncate max-w-[150px] sm:max-w-none">{selectedBasket.location}</span>
                                                </div>
                                            )}
                                            {selectedBasket.guest_capacity && (
                                                <Badge variant="outline" className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs">
                                                    {selectedBasket.guest_capacity} hóspedes
                                                </Badge>
                                            )}
                                            <Badge variant="secondary" className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs">
                                                {selectedBasket.basket_items?.filter(i => i.item_type === 'internal').length || 0} internas
                                            </Badge>
                                            <BasketDetailsDialog
                                                basketName={`Concorrentes: ${selectedBasket.name}`}
                                                items={selectedBasket.basket_items?.filter(i => i.item_type === 'external') || []}
                                                onRefresh={() => mutateBaskets()}
                                                onDeleteItem={async (airbnbId, basketItemId) => {
                                                    try {
                                                        const res = await fetch(`/api/baskets/items?id=${basketItemId}`, { method: 'DELETE' });
                                                        if (res.ok) {
                                                            toast({ title: "Removido com sucesso" });
                                                            mutateBaskets();
                                                        }
                                                    } catch (err) {
                                                        console.error(err);
                                                        toast({ title: "Erro ao remover", variant: "destructive" });
                                                    }
                                                }}
                                                trigger={
                                                    <Badge variant="default" className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs cursor-pointer hover:bg-primary/80 transition-colors">
                                                        {selectedBasket.basket_items?.filter(i => i.item_type === 'external').length || 0} competidores
                                                    </Badge>
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-primary hover:bg-primary/10"
                                            onClick={async () => {
                                                const btn = document.getElementById('btn-scrape') as HTMLButtonElement;
                                                if (btn) btn.disabled = true;
                                                toast({ title: "Iniciando atualização de dados...", description: "Isso pode levar alguns minutos." });

                                                try {
                                                    // Call n8n or scraper API
                                                    const res = await fetch('/api/baskets/scrape', {
                                                        method: 'POST',
                                                        body: JSON.stringify({ basketId: selectedBasket.id })
                                                    });

                                                    if (res.ok) {
                                                        toast({ title: "Atualização solicitada com sucesso!", description: "Os dados aparecerão em breve." });
                                                    } else {
                                                        throw new Error('Falha ao solicitar atualização');
                                                    }
                                                } catch (error) {
                                                    console.error(error);
                                                    toast({ title: "Erro ao atualizar", description: "Tente novamente mais tarde.", variant: "destructive" });
                                                } finally {
                                                    if (btn) btn.disabled = false;
                                                }
                                            }}
                                            id="btn-scrape"
                                        >
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Atualizar Dados
                                        </Button>
                                        <EditBasketDialog
                                            basket={selectedBasket}
                                            properties={properties}
                                            onSuccess={() => mutateBaskets()}
                                            trigger={
                                                <Button variant="outline" size="sm">
                                                    <Pencil className="h-4 w-4 mr-2" />
                                                    Editar
                                                </Button>
                                            }
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-destructive hover:bg-destructive/10"
                                            onClick={async () => {
                                                if (!confirm('Tem certeza que deseja excluir esta cesta?')) return;
                                                try {
                                                    const res = await fetch(`/api/baskets?id=${selectedBasket.id}`, { method: 'DELETE' });
                                                    if (res.ok) {
                                                        toast({ title: "Cesta excluída com sucesso" });
                                                        mutateBaskets();
                                                    } else {
                                                        throw new Error('Falha ao excluir');
                                                    }
                                                } catch (error) {
                                                    console.error(error);
                                                    toast({ title: "Erro ao excluir cesta", variant: "destructive" });
                                                }
                                            }}
                                        >
                                            <Trash className="h-4 w-4 mr-2" />
                                            Excluir
                                        </Button>
                                    </div>
                                </div>

                                {/* Filters Bar */}
                                <Card className="p-4 border-none shadow-sm bg-muted/20">
                                    <div className="flex flex-col lg:flex-row gap-4 items-end lg:items-center justify-between">
                                        <div className="flex flex-wrap gap-4 items-center w-full lg:w-auto">
                                            {/* View Mode Toggle */}
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                                                        <TrendingUp className="w-3 h-3" /> Visualização
                                                    </span>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs p-4">
                                                            <p className="font-bold mb-1">Como funciona a Visualização?</p>
                                                            <p className="mb-2"><strong>Curva (Datas):</strong> Mostra o preço "futuro" para cada dia de check-in. É o preço que o turista está vendo hoje para reservar naquela data.</p>
                                                            <p><strong>Histórico (Extração):</strong> Mostra como o preço MUDOU ao longo do tempo. Selecione um período de check-in (ex: Reveillon) e veja se o preço dele subiu ou caiu nas últimas semanas.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                                <div className="flex bg-muted p-1 rounded-lg">
                                                    <button
                                                        onClick={() => setChartMode('checkin')}
                                                        className={cn(
                                                            "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                                                            chartMode === 'checkin' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                                        )}
                                                    >
                                                        Curva (Datas)
                                                    </button>
                                                    <button
                                                        onClick={() => setChartMode('extraction')}
                                                        className={cn(
                                                            "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                                                            chartMode === 'extraction' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                                        )}
                                                    >
                                                        Histórico (Extração)
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="h-8 w-px bg-border hidden lg:block" />

                                            {/* Check-in Range Filter */}
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                                                        <CalendarIcon className="w-3 h-3" /> Período Check-in
                                                    </span>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">
                                                            <p>Filtre pelas datas da RESERVA (quando o hóspede dorme no imóvel).</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" size="sm" className="h-9 justify-start text-left font-normal w-[240px]">
                                                            {checkinDateRange?.from ? (
                                                                checkinDateRange.to ? (
                                                                    <>
                                                                        {format(checkinDateRange.from, "dd/MM/yy")} - {format(checkinDateRange.to, "dd/MM/yy")}
                                                                    </>
                                                                ) : (
                                                                    format(checkinDateRange.from, "dd/MM/yy")
                                                                )
                                                            ) : (
                                                                <span>Selecione período</span>
                                                            )}
                                                            <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar
                                                            initialFocus
                                                            mode="range"
                                                            defaultMonth={checkinDateRange?.from}
                                                            selected={checkinDateRange}
                                                            onSelect={setCheckinDateRange}
                                                            numberOfMonths={2}
                                                            locale={ptBR}
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>

                                            {/* Extraction Range Filter */}
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                                                    <History className="w-3 h-3" /> Data Extração
                                                </span>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" size="sm" className="h-9 justify-start text-left font-normal w-[240px]">
                                                            {extractionDateRange?.from ? (
                                                                extractionDateRange.to ? (
                                                                    <>
                                                                        {format(extractionDateRange.from, "dd/MM/yy")} - {format(extractionDateRange.to, "dd/MM/yy")}
                                                                    </>
                                                                ) : (
                                                                    format(extractionDateRange.from, "dd/MM/yy")
                                                                )
                                                            ) : (
                                                                <span>Todo histórico</span>
                                                            )}
                                                            <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar
                                                            initialFocus
                                                            mode="range"
                                                            defaultMonth={extractionDateRange?.from}
                                                            selected={extractionDateRange}
                                                            onSelect={setExtractionDateRange}
                                                            numberOfMonths={2}
                                                            locale={ptBR}
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <MarketKPICards
                                    averagePrice={marketKPIs.averagePrice}
                                    medianPrice={marketKPIs.medianPrice}
                                    totalCompetitors={marketKPIs.totalCompetitors}
                                    averageRating={marketKPIs.averageRating}
                                    averageGuests={marketKPIs.averageGuests}
                                />

                                <div className="grid grid-cols-1 gap-6">
                                    <PriceEvolutionChart
                                        data={richChartData}
                                        competitorMap={competitorMap}
                                        onPointClick={handlePointClick}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
                                    {/* INTERNAL PROPERTIES */}
                                    <Card className="flex flex-col h-full overflow-hidden">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                                <span>Imóveis Internos</span>
                                                <Badge variant="secondary">{selectedBasket.basket_items?.filter(i => i.item_type === 'internal').length || 0}</Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-3 custom-scrollbar">
                                            {selectedBasket.basket_items?.filter(i => i.item_type === 'internal').map(item => {
                                                // Try to find full property details from loaded properties
                                                const prop = properties.find(p => p.idpropriedade === item.internal_property_id) || item.internal_property_data;
                                                return (
                                                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                                {item.internal_property_id?.substring(0, 2)}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-sm">{prop?.nome || item.internal_property_id}</p>
                                                                <p className="text-xs text-muted-foreground">{prop?.cidade || ''} • {prop?.quantidade_quartos || 0} quartos</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {(!selectedBasket.basket_items?.some(i => i.item_type === 'internal')) && (
                                                <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground text-sm">
                                                    Nenhum imóvel interno nesta cesta.
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 pt-2 border-t bg-background z-10">
                                            <EditBasketDialog
                                                basket={selectedBasket}
                                                properties={properties}
                                                onSuccess={() => mutateBaskets()}
                                                trigger={
                                                    <Button className="w-full" variant="outline">
                                                        <Plus className="h-4 w-4 mr-2" /> Adicionar Imóvel
                                                    </Button>
                                                }
                                            />
                                        </div>
                                    </Card>

                                    {/* EXTERNAL COMPETITORS */}
                                    <Card className="flex flex-col h-full overflow-hidden">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                                <span>Concorrentes Externos</span>
                                                <Badge variant="default">{selectedBasket.basket_items?.filter(i => i.item_type === 'external').length || 0}</Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-3 custom-scrollbar">
                                            {selectedBasket.basket_items?.filter(i => i.item_type === 'external').map(item => {
                                                const displayName = item.airbnb_data?.nome_anuncio || `Anúncio ${item.airbnb_listing_id}`;
                                                const displayUrl = item.airbnb_data?.url_anuncio || `https://www.airbnb.com.br/rooms/${item.airbnb_listing_id}`;

                                                return (
                                                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50 group hover:border-primary/50 transition-colors">
                                                        <CompetitorDetailsDialog
                                                            competitor={{
                                                                id: item.airbnb_listing_id || item.id,
                                                                name: displayName,
                                                                url: displayUrl,
                                                                history: item.history,
                                                                avgRating: item.airbnb_data?.media_avaliacao,
                                                                guests: item.airbnb_data?.hospedes_adultos
                                                            }}
                                                            trigger={
                                                                <div className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer pr-2">
                                                                    <div className="h-8 w-8 rounded bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs shrink-0">
                                                                        Ab
                                                                    </div>
                                                                    <div className="overflow-hidden">
                                                                        <p className="font-medium text-sm truncate leading-tight" title={displayName}>
                                                                            {displayName}
                                                                        </p>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <p className="text-xs text-muted-foreground flex items-center gap-1 bg-background/50 px-1 rounded">
                                                                                <ExternalLink className="h-2 w-2" />
                                                                                {item.airbnb_listing_id}
                                                                            </p>
                                                                            <span className="text-xs font-bold text-primary">
                                                                                {item.airbnb_data?.preco_por_noite ? `R$ ${item.airbnb_data.preco_por_noite}` : '-'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            }
                                                        />
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive shrink-0"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <Trash className="h-3 w-3" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Excluir concorrente?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Você tem certeza que deseja remover <b>{displayName}</b>?
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        className="bg-destructive hover:bg-destructive/90"
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            try {
                                                                                const res = await fetch(`/api/baskets/items?id=${item.id}`, { method: 'DELETE' });
                                                                                if (res.ok) {
                                                                                    toast({ title: "Removido com sucesso" });

                                                                                    // 1. Optimistic Update
                                                                                    setSelectedBasket(prev => {
                                                                                        if (!prev) return prev;
                                                                                        return {
                                                                                            ...prev,
                                                                                            basket_items: prev.basket_items?.filter(i => i.id !== item.id)
                                                                                        };
                                                                                    });

                                                                                    // 2. Background Refresh
                                                                                    mutateBaskets();
                                                                                }
                                                                            } catch (err) {
                                                                                console.error(err);
                                                                                toast({ title: "Erro ao remover", variant: "destructive" });
                                                                            }
                                                                        }}
                                                                    >
                                                                        Excluir
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <div className="p-4 pt-2 border-t bg-background z-10">
                                            <AddItemDialog
                                                basketId={selectedBasket.id}
                                                basketName={selectedBasket.name}
                                                // Use first internal property or first available global property as reference for geolocation
                                                property={(() => {
                                                    const internalId = selectedBasket.basket_items?.find(i => i.item_type === 'internal')?.internal_property_id;
                                                    return (internalId ? properties.find(p => p.idpropriedade === internalId) : null) || properties[0];
                                                })()}
                                                existingIds={selectedBasket.basket_items?.map(i => i.airbnb_listing_id || i.id) || []}
                                                onSuccess={() => mutateBaskets()}
                                            />
                                        </div>
                                    </Card>
                                </div>

                                <DailyCompositionDialog
                                    open={compositionDialog.open}
                                    onOpenChange={(open) => setCompositionDialog(prev => ({ ...prev, open }))}
                                    date={compositionDialog.date}
                                    avgPrice={compositionDialog.avgPrice}
                                    items={compositionDialog.items || []}
                                    history={compositionDialog.history || []}
                                />
                            </>
                        ) : (
                            <Card className="p-12">
                                <div className="flex flex-col items-center justify-center text-center space-y-4">
                                    <div className="p-4 bg-muted rounded-full">
                                        <Target className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Nenhuma cesta selecionada</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Selecione uma cesta na barra lateral ou crie uma nova para começar
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
