'use client'

import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis, XAxis, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface ChartData {
    date: string
    avgPrice: number
    [key: string]: any
}

interface PriceEvolutionChartProps {
    data: ChartData[]
    competitorMap?: Record<string, string>
    onPointClick?: (data: any) => void
}

export function PriceEvolutionChart({ data, competitorMap = {}, onPointClick }: PriceEvolutionChartProps) {
    if (!data || data.length === 0) {
        return (
            <Card className="h-[400px] flex items-center justify-center">
                <p className="text-muted-foreground">Sem dados históricos para exibir</p>
            </Card>
        )
    }

    return (
        <Card className="border-none shadow-sm h-[400px]">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold">Evolução do Preço Médio</CardTitle>
                <CardDescription>
                    Variação da diária média sugerida por data de check-in.
                    <span className="ml-1 text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded cursor-pointer hidden md:inline-block">Clique nos pontos para ver detalhes</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0 mt-4">
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <LineChart
                            data={data}
                            onClick={(e: any) => {
                                if (e && e.activePayload && e.activePayload.length > 0) {
                                    onPointClick?.(e.activePayload[0].payload);
                                }
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <defs>
                                <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                            <XAxis
                                dataKey="date"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => {
                                    const date = new Date(value)
                                    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                                }}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `R$ ${value}`}
                            />
                            <Tooltip
                                cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5 5' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const dataPoint = payload[0].payload;
                                        const avgPrice = payload[0].value;

                                        // Extract components
                                        const components = Object.keys(dataPoint)
                                            .filter(k => k.startsWith('listing_'))
                                            .map(k => ({
                                                id: k.replace('listing_', ''),
                                                price: dataPoint[k],
                                                name: competitorMap[k.replace('listing_', '')] || `Anúncio ${k.replace('listing_', '')}`
                                            }))
                                            .sort((a, b) => b.price - a.price); // Sort by price descending

                                        return (
                                            <div className="bg-background border rounded-lg shadow-lg p-3 max-w-[280px]">
                                                <p className="text-xs text-muted-foreground mb-2 pb-2 border-b flex justify-between items-center">
                                                    <span>{new Date(dataPoint.date).toLocaleDateString('pt-BR', { dateStyle: 'long' })}</span>
                                                </p>
                                                <div className="flex flex-col gap-1 mb-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-sm text-blue-600">Média Mercado:</span>
                                                        <span className="font-bold text-blue-600 text-sm">
                                                            R$ {avgPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                    {dataPoint.internalAvgPrice !== undefined && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-sm text-sky-600">Média Interna:</span>
                                                            <span className="font-bold text-sky-600 text-sm">
                                                                R$ {dataPoint.internalAvgPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {components.length > 0 && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Composição:</p>
                                                        <div className="max-h-[100px] overflow-y-auto custom-scrollbar pr-1">
                                                            {components.slice(0, 3).map(comp => (
                                                                <div key={comp.id} className="flex justify-between text-xs py-0.5">
                                                                    <span className="truncate max-w-[140px] text-muted-foreground" title={comp.name}>{comp.name}</span>
                                                                    <span className="font-medium">R$ {comp.price.toLocaleString('pt-BR')}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {components.length > 3 && (
                                                            <p className="text-[10px] text-center text-primary pt-1 italic cursor-pointer">
                                                                + {components.length - 3} outros (clique para ampliar)
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="avgPrice"
                                name="Cesta (Mercado)"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{
                                    r: 4,
                                    strokeWidth: 2,
                                    fill: '#fff',
                                    cursor: 'pointer',
                                    onClick: (e: any, payload: any) => {
                                        if (payload && payload.payload) {
                                            onPointClick?.(payload.payload);
                                        } else if (e && e.payload) {
                                            // Fallback for some Recharts versions
                                            onPointClick?.(e.payload);
                                        }
                                    }
                                }}
                                activeDot={{
                                    r: 8,
                                    strokeWidth: 0,
                                    fill: '#2563eb',
                                    cursor: 'pointer',
                                    onClick: (e: any, payload: any) => {
                                        if (payload && payload.payload) {
                                            onPointClick?.(payload.payload);
                                        }
                                    }
                                }}
                            />
                            {data.some(d => d.internalAvgPrice !== undefined) && (
                                <Line
                                    type="monotone"
                                    dataKey="internalAvgPrice"
                                    name="Imóveis Internos"
                                    stroke="#0ea5e9"
                                    strokeWidth={2}
                                    connectNulls={true}
                                    dot={{
                                        r: 4,
                                        strokeWidth: 2,
                                        fill: '#fff',
                                        cursor: 'pointer',
                                        onClick: (e: any, payload: any) => {
                                            if (payload && payload.payload) {
                                                onPointClick?.(payload.payload);
                                            } else if (e && e.payload) {
                                                onPointClick?.(e.payload);
                                            }
                                        }
                                    }}
                                    activeDot={{
                                        r: 8,
                                        strokeWidth: 0,
                                        fill: '#0284c7',
                                        cursor: 'pointer',
                                        onClick: (e: any, payload: any) => {
                                            if (payload && payload.payload) {
                                                onPointClick?.(payload.payload);
                                            }
                                        }
                                    }}
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
