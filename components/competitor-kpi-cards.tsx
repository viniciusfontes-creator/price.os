'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Users, Star, BarChart3 } from 'lucide-react'

interface KPICardsProps {
    averagePrice: number
    medianPrice: number
    totalCompetitors: number
    averageRating: number
    averageGuests?: number
}

export function MarketKPICards({ averagePrice, medianPrice, totalCompetitors, averageRating, averageGuests }: KPICardsProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
            {/* Average Price */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Preço Médio Mercado</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-xl lg:text-2xl font-bold whitespace-nowrap tracking-tight">
                        R$ {averagePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">Por noite</p>
                        {averageGuests !== undefined && averageGuests > 0 && (
                            <div className="flex items-center text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 rounded-md bg-muted/50" title="Média de Hóspedes">
                                <Users className="w-3 h-3 mr-1" />
                                {averageGuests.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Median Price */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Mediana do Mercado</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-xl lg:text-2xl font-bold whitespace-nowrap tracking-tight">
                        R$ {medianPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-muted-foreground">Airbnb - Por noite</p>
                </CardContent>
            </Card>

            {/* Total Competitors */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Anúncios</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-xl lg:text-2xl font-bold">
                        {totalCompetitors.toLocaleString('pt-BR')}
                    </div>
                    <p className="text-xs text-muted-foreground">Nesta região</p>
                </CardContent>
            </Card>

            {/* Average Rating */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avaliação Média</CardTitle>
                    <Star className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-xl lg:text-2xl font-bold">
                        {averageRating.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">Estrelas (Airbnb)</p>
                </CardContent>
            </Card>
        </div>
    )
}
