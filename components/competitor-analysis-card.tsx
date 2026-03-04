import React, { useMemo } from 'react';
import useSWR from 'swr';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyIcon, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Basket } from '@/types';

interface CompetitorAnalysisCardProps {
    unitId: string;
    unitName: string;
    currentPrice: number | null;
}

export function CompetitorAnalysisCard({ unitId, unitName, currentPrice }: CompetitorAnalysisCardProps) {
    const { data: basketData } = useSWR<any>(
        unitId ? `/api/baskets?propertyId=${unitId}` : null,
        (url: string) => fetch(url).then(res => res.json())
    );

    const competitorMetrics = useMemo(() => {
        if (!basketData?.data || basketData.data.length === 0) return null;

        const basket = basketData.data[0] as Basket;
        if (!basket.basket_items) return null;

        const competitors = basket.basket_items;
        if (competitors.length === 0) return null;

        const startDates = competitors.map(c => c.history?.[0]?.data_extracao).filter(Boolean);

        const validList: { price: number; name: string }[] = [];

        competitors.forEach((curr) => {
            let price = curr.airbnb_data?.preco_por_noite || 0;
            if (!price && curr.airbnb_data?.preco_total && curr.airbnb_data?.quantidade_noites) {
                try {
                    price = curr.airbnb_data.preco_total / curr.airbnb_data.quantidade_noites;
                } catch (e) {
                    price = 0;
                }
            }
            if (price > 0) {
                validList.push({
                    price,
                    name: curr.airbnb_data?.nome_anuncio || "Anúncio sem nome"
                });
            }
        });

        if (validList.length === 0) return null;

        const sum = validList.reduce((acc, curr) => acc + curr.price, 0);
        const avgPrice = sum / validList.length;
        const minPrice = Math.min(...validList.map(v => v.price));
        const maxPrice = Math.max(...validList.map(v => v.price));

        validList.sort((a, b) => a.price - b.price);

        return {
            avgPrice,
            minPrice,
            maxPrice,
            count: competitors.length,
            basketId: basket.id,
            competitorsList: validList
        };
    }, [basketData]);

    const pricePositioning = useMemo(() => {
        if (!currentPrice || !competitorMetrics || competitorMetrics.avgPrice === 0) return null;

        const myPrice = currentPrice;
        const marketPrice = competitorMetrics.avgPrice;
        const diffPercent = ((myPrice - marketPrice) / marketPrice) * 100;

        let status: 'low' | 'medium' | 'high' = 'medium';
        if (diffPercent < -10) status = 'low';
        else if (diffPercent > 10) status = 'high';

        return {
            diffPercent,
            status,
            marketPrice
        };
    }, [currentPrice, competitorMetrics]);

    if (basketData === undefined) {
        return <p className="text-xs text-muted-foreground italic">Carregando cesta...</p>
    }

    if (competitorMetrics) {
        return (
            <Link href={`/correlacao?basketId=${competitorMetrics.basketId}`} className="block">
                <Card className="hover:border-primary/50 transition-colors bg-blue-50/30">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className="font-semibold text-sm text-blue-900">Análise da Concorrência</h4>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Baseado em {competitorMetrics.count} concorrentes da cesta.</p>
                            </div>
                            <Badge variant={
                                pricePositioning?.status === 'high' ? 'destructive' :
                                    pricePositioning?.status === 'low' ? 'default' : 'secondary'
                            } className={pricePositioning?.status === 'low' ? 'bg-success' : ''}>
                                {pricePositioning?.diffPercent && pricePositioning.diffPercent > 0 ? '+' : ''}
                                {pricePositioning?.diffPercent?.toFixed(1)}%
                            </Badge>
                        </div>

                        <div className="flex justify-between items-end mb-4 text-xs font-mono">
                            <div className="text-center">
                                <span className="text-[10px] text-muted-foreground block mb-0.5 uppercase tracking-wider">Min</span>
                                R$ {competitorMetrics.minPrice.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-center">
                                <span className="text-[10px] text-primary block mb-0.5 font-bold uppercase tracking-wider">Média</span>
                                <span className="font-bold text-sm text-blue-700">R$ {competitorMetrics.avgPrice.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[10px] text-muted-foreground block mb-0.5 uppercase tracking-wider">Max</span>
                                R$ {competitorMetrics.maxPrice.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                        </div>

                        <div className="relative mt-2 mb-1 w-full h-1 bg-gradient-to-r from-green-300 via-blue-300 to-red-300 rounded-full">
                            <div
                                className="absolute top-0 w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-sm transform -translate-x-1/2 -top-1 transition-all duration-500"
                                style={{
                                    left: `${Math.min(Math.max(((pricePositioning?.diffPercent || 0) + 50), 5), 95)}%`
                                }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            <span>Mais Barato</span>
                            <span>Na Média</span>
                            <span>Mais Caro</span>
                        </div>

                        <p className="text-xs text-blue-800 mt-2">
                            {pricePositioning?.status === 'high' && "Seu preço está acima da concorrência."}
                            {pricePositioning?.status === 'low' && "Você está competitivo."}
                            {pricePositioning?.status === 'medium' && "Seu preço está alinhado com o mercado."}
                        </p>
                    </CardContent>
                </Card>
            </Link>
        )
    }

    return (
        <Card className="border border-amber-200/70 bg-amber-50/20">
            <CardContent className="p-4 flex items-center gap-4">
                <div className="shrink-0 p-2 bg-amber-100/60 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-semibold text-amber-900 leading-tight">Ponto Cego Identificado</h4>
                    <p className="text-[11px] text-amber-700/80 mt-0.5 leading-snug">
                        Você está definindo estratégias sem olhar para o lado.
                    </p>
                </div>
                <Link href={`/correlacao?addBasket=true&propertyId=${unitId}&propertyName=${encodeURIComponent(unitName)}`} className="shrink-0">
                    <Button size="sm" variant="outline" className="h-8 text-[11px] font-medium border-amber-300/80 text-amber-800 hover:bg-amber-100/60 rounded-lg">
                        Criar Cesta
                    </Button>
                </Link>
            </CardContent>
        </Card>
    )
}
