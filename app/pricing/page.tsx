"use client"

import { useState, useEffect, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine,
} from "recharts"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import {
  Plus,
  X,
  Calculator,
  DollarSign,
  Target,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
} from "lucide-react"
import { InitialLoadingScreen, PricingSkeleton } from "@/components/page-skeleton"
import { FilterBar } from "@/components/filters/filter-bar"
import { useGlobalFilters } from "@/contexts/global-filters-context"
import { applyGlobalFilters, getFilterOptions } from "@/lib/filter-utils"
import { useDashboardData } from "@/contexts/dashboard-provider"

interface UnitPricing {
  id: string
  name: string
  currentPrice: number
  targetPrice: number
  status: "overpriced" | "underpriced" | "optimal"
  marketAvg: number
  propertyId: string
  type: "luxury" | "standard" | "hotel"
}

const ASSET_CONFIGS = {
  luxury: {
    occMax: 0.30,
    k: 2.5,
    name: "Alto Padrão / Luxury",
    description: "Foco em seleção de público e margem",
    potential: "6-9 noites",
  },
  standard: {
    occMax: 0.60,
    k: 1.2,
    name: "Short-Stay Padrão",
    description: "Equilíbrio entre volume e ticket",
    potential: "15-18 noites",
  },
  hotel: {
    occMax: 0.90,
    k: 0.5,
    name: "Hoteleiro / High Turnover",
    description: "Foco em faturamento por giro",
    potential: "21-27 noites",
  },
} as const

const getAssetClass = (item: IntegratedData): "luxury" | "standard" | "hotel" => {
  if (item.propriedade.grupo_nome === "Luxury") return "luxury"
  if (item.propriedade.empreendimento_pousada === "mixed") return "hotel"
  return "standard"
}

interface SimulationResult {
  newPrice: number
  newOccupancy: number
  newRevenue: number
  revenueChange: number
  occupancyChange: number
  vsOptimal: number
  goalAchievement: number
  config: typeof ASSET_CONFIGS.standard
}

interface Metrics {
  currentAvgPrice: number
  optimalPrice: number
  priceGap: number
  revenueEfficiency: number
}

interface Property {
  id: string
  name: string
  praca: string
  grupo: string
}

export default function PricingPage() {
  // Use centralized dashboard data from SWR cache
  const { data: rawData, loading, isFirstLoad } = useDashboardData()
  const { filters } = useGlobalFilters()

  // Apply global filters to data
  const filteredData = useMemo(
    () => applyGlobalFilters(rawData, filters),
    [rawData, filters]
  )

  // Get filter options from data
  const filterOptions = useMemo(
    () => getFilterOptions(rawData),
    [rawData]
  )

  const [units, setUnits] = useState<UnitPricing[]>([])
  const [selectedUnit, setSelectedUnit] = useState<string>("")
  const [simulatedPrice, setSimulatedPrice] = useState<number>(0)
  const [metrics, setMetrics] = useState<Metrics>({
    currentAvgPrice: 0,
    optimalPrice: 0,
    priceGap: 0,
    revenueEfficiency: 0,
  })
  const [desiredGoal, setDesiredGoal] = useState<number>(15000)
  const [availableNights, setAvailableNights] = useState<number>(30)

  // Market Intelligence State (Fetching real data)
  const [cestas, setCestas] = useState<any[]>([])
  const [novaCesta, setNovaCesta] = useState({ nome: "", concorrentes: [""] })
  const [dialogOpen, setDialogOpen] = useState(false)

  // Load Baskets
  useEffect(() => {
    async function loadBaskets() {
      try {
        const res = await fetch('/api/baskets')
        const result = await res.json()
        if (result.success) {
          // Format data for the UI
          const formatted = result.data.map((b: any) => {
            const competitors = b.basket_items?.map((i: any) => i.airbnb_data?.nome_anuncio || 'Anúncio').filter(Boolean) || []
            const avgCompPrice = b.basket_items?.length > 0
              ? b.basket_items.reduce((acc: number, i: any) => acc + (i.airbnb_data?.preco_por_noite || 0), 0) / b.basket_items.length
              : 0

            return {
              id: b.id,
              nome: b.name,
              concorrentes: competitors,
              precoMedio: Math.round(avgCompPrice),
              nossaMedia: 0, // Will be populated from filteredData if possible
            }
          })
          setCestas(formatted)
        }
      } catch (err) {
        console.error("Erro ao carregar cestas:", err)
      }
    }
    loadBaskets()
  }, [])

  // Update nossaMedia based on properties in the basket
  useEffect(() => {
    if (cestas.length > 0 && filteredData.length > 0) {
      setCestas(prev => prev.map(cesta => {
        // Find which properties belong to this basket (this would require basket -> internal_property_id mapping)
        // Since cestas from API has internal_property_id, let's fetch it too.
        // For now, let's find the property in filteredData that matches if possible.
        // We'll need to adjust the API call in GET /api/baskets to include internal_property_id if not there.
        return cesta
      }))
    }
  }, [filteredData])

  // Process pricing data when dashboard data changes
  useEffect(() => {
    if (!loading && filteredData.length > 0) {
      const pricingUnits: UnitPricing[] = filteredData.map((item) => {
        const currentPrice = item.metricas?.precoMedioNoite || 0
        const marketAvg = currentPrice * 1.1

        return {
          id: item.propriedade.idpropriedade,
          name: item.propriedade.nomepropriedade,
          currentPrice,
          targetPrice: marketAvg * 0.95,
          status: currentPrice > marketAvg * 1.1 ? "overpriced" : currentPrice < marketAvg * 0.9 ? "underpriced" : "optimal",
          marketAvg,
          propertyId: item.propriedade.idpropriedade,
          type: getAssetClass(item),
        }
      })
      setUnits(pricingUnits)

      if (pricingUnits.length > 0) {
        setSelectedUnit(pricingUnits[0].id)
        setSimulatedPrice(pricingUnits[0].currentPrice)
      }

      const avgPrice = pricingUnits.reduce((acc, u) => acc + u.currentPrice, 0) / pricingUnits.length
      const optimal = avgPrice * 1.05

      setMetrics({
        currentAvgPrice: avgPrice,
        optimalPrice: optimal,
        priceGap: ((avgPrice - optimal) / optimal) * 100,
        revenueEfficiency: 88.5,
      })
    }
  }, [filteredData, loading])


  const selectedUnitData = units.find((u) => u.id === selectedUnit)

  const lafferData = useMemo(() => {
    const data = []
    const optimal = metrics.optimalPrice || 500
    const config = selectedUnitData ? ASSET_CONFIGS[selectedUnitData.type] : ASSET_CONFIGS.standard

    for (let p = 100; p <= 1500; p += 25) {
      const priceRatio = p / optimal
      // Quadratic model: Occ = OccMax * (1 - k * (ratio - 1)^2)
      const simulatedOcc = Math.max(0, config.occMax * (1 - config.k * Math.pow(priceRatio - 1, 2)))
      const revenue = p * simulatedOcc * availableNights
      data.push({ price: p, revenue })
    }
    return data
  }, [metrics.optimalPrice, availableNights, selectedUnitData])

  const simulation = useMemo(() => {
    if (!selectedUnitData) return null
    const config = ASSET_CONFIGS[selectedUnitData.type]
    const priceRatio = simulatedPrice / metrics.optimalPrice
    const newOccupancy = Math.max(0, config.occMax * (1 - config.k * Math.pow(priceRatio - 1, 2))) * 100

    // Revenue based on structural nights
    const currentRevenue = selectedUnitData.currentPrice * (config.occMax * 0.8) * availableNights
    const newRevenue = simulatedPrice * (newOccupancy / 100) * availableNights

    return {
      newPrice: simulatedPrice,
      newOccupancy,
      newRevenue,
      revenueChange: currentRevenue > 0 ? ((newRevenue - currentRevenue) / currentRevenue) * 100 : 0,
      occupancyChange: newOccupancy - (config.occMax * 80),
      vsOptimal: ((simulatedPrice - metrics.optimalPrice) / metrics.optimalPrice) * 100,
      goalAchievement: (newRevenue / desiredGoal) * 100,
      config,
    }
  }, [selectedUnitData, simulatedPrice, metrics.optimalPrice, desiredGoal, availableNights])

  const historicalData = [
    { month: "Jan", price: 420, occupancy: 85 },
    { month: "Fev", price: 450, occupancy: 78 },
    { month: "Mar", price: 410, occupancy: 82 },
    { month: "Abr", price: 390, occupancy: 88 },
    { month: "Mai", price: 430, occupancy: 75 },
    { month: "Jun", price: 460, occupancy: 70 },
  ]

  const dadosComparativos = [
    { regiao: "Copacabana", nossoPreco: 198, concorrencia: 205, marketShare: 12.5 },
    { regiao: "Ipanema", nossoPreco: 220, concorrencia: 215, marketShare: 8.3 },
    { regiao: "Vila Madalena", nossoPreco: 175, concorrencia: 180, marketShare: 15.2 },
    { regiao: "Leblon", nossoPreco: 250, concorrencia: 245, marketShare: 6.8 },
  ]

  const distribuicaoPrecos = [
    { faixa: "R$ 100-150", quantidade: 15, cor: "#007aff" },
    { faixa: "R$ 150-200", quantidade: 35, cor: "#34c759" },
    { faixa: "R$ 200-250", quantidade: 28, cor: "#ff9500" },
    { faixa: "R$ 250+", quantidade: 12, cor: "#ff3b30" },
  ]

  const salvarCesta = () => {
    if (novaCesta.nome && novaCesta.concorrentes.some((c) => c.trim())) {
      setCestas((prev) => [
        ...prev,
        {
          id: Date.now(),
          nome: novaCesta.nome,
          concorrentes: novaCesta.concorrentes.filter((c) => c.trim()),
          precoMedio: Math.floor(Math.random() * 100) + 150,
          nossaMedia: Math.floor(Math.random() * 100) + 150,
        },
      ])
      setNovaCesta({ nome: "", concorrentes: [""] })
      setDialogOpen(false)
    }
  }

  const adicionarConcorrente = () => {
    setNovaCesta((prev) => ({
      ...prev,
      concorrentes: [...prev.concorrentes, ""],
    }))
  }

  const removerConcorrente = (index: number) => {
    setNovaCesta((prev) => ({
      ...prev,
      concorrentes: prev.concorrentes.filter((_, i) => i !== index),
    }))
  }

  // Show nice loading screen on first load
  if (isFirstLoad) {
    return <InitialLoadingScreen />
  }

  // Show skeleton if loading and we have no data
  if (loading && rawData.length === 0) {
    return <PricingSkeleton />
  }

  return (
    <div className="space-y-6">
      <FilterBar filterOptions={filterOptions} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pricing & Mercado</h1>
          <p className="text-muted-foreground italic">Pilar 3: Inteligência competitiva e otimização de lucro.</p>
        </div>


      </div>

      <Tabs defaultValue="interna" className="space-y-6">
        <TabsList className="bg-muted p-1 w-full sm:w-auto overflow-x-auto flex-shrink-0">
          <TabsTrigger value="interna" className="text-xs sm:text-sm whitespace-nowrap">Análise Interna</TabsTrigger>
          <TabsTrigger value="mercado" className="text-xs sm:text-sm whitespace-nowrap">Inteligência de Mercado</TabsTrigger>
        </TabsList>

        <TabsContent value="interna" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Preço Médio Atual</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R$ {metrics.currentAvgPrice.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</div>
                <p className="text-xs text-muted-foreground mt-1">valor médio por diária</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Preço Ótimo (Alvo)</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R$ {metrics.optimalPrice.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</div>
                <p className="text-xs text-muted-foreground mt-1">Sugerido por IA</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Gap de Preço</CardTitle>
                <TrendingUp className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.priceGap > 0 ? "+" : ""}{metrics.priceGap.toFixed(1)}%</div>
                <Badge variant={Math.abs(metrics.priceGap) < 10 ? "secondary" : "destructive"}>
                  {Math.abs(metrics.priceGap) < 10 ? "Alinhado" : "Ajuste Necessário"}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Eficiência</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.revenueEfficiency}%</div>
                <p className="text-xs text-muted-foreground mt-1">RevPAR vs Potencial</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Curva de Laffer (Elasticidade)</CardTitle>
                <CardDescription>Visualização do ponto de equilíbrio entre preço e ocupação.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lafferData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="price" />
                      <YAxis tickFormatter={(v: number) => `R$${v / 1000}k`} />
                      <Tooltip formatter={(v: any) => `R$ ${v.toLocaleString("pt-BR")}`} />
                      <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={3} dot={false} />
                      <ReferenceLine
                        y={desiredGoal}
                        stroke="var(--destructive)"
                        strokeDasharray="3 3"
                        label={{ position: 'right', value: `Meta: R$ ${desiredGoal / 1000}k`, fill: 'var(--destructive)', fontSize: 10 }}
                      />
                      <ReferenceDot
                        x={metrics.optimalPrice}
                        y={lafferData.find(d => d.price >= metrics.optimalPrice)?.revenue}
                        r={6}
                        fill="var(--success)"
                        stroke="white"
                        label={{ position: 'top', value: 'Ótimo', fill: 'var(--success)', fontSize: 10 }}
                      />
                      {simulation && (
                        <ReferenceDot
                          x={simulatedPrice}
                          y={simulation.newRevenue}
                          r={8}
                          fill="var(--chart-1)"
                          stroke="white"
                          label={{ position: 'bottom', value: 'Simulado', fill: 'var(--chart-1)', fontSize: 10 }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Simulador de Impacto</CardTitle>
                <CardDescription>Ajuste o preço e veja a projeção de ocupação e receita.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Propriedade/Unidade</Label>
                    <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Preço Simulado</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={simulatedPrice}
                        onChange={(e) => setSimulatedPrice(Number(e.target.value))}
                        className="h-9 font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Ajuste de Preço</Label>
                    <span className="text-sm font-medium">R$ {simulatedPrice} / diária</span>
                  </div>
                  <Slider value={[simulatedPrice]} min={100} max={1500} step={10} onValueChange={(v) => setSimulatedPrice(v[0])} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Meta Desejada (R$)</Label>
                    <Input
                      type="number"
                      value={desiredGoal}
                      onChange={(e) => setDesiredGoal(Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Noites Disponíveis</Label>
                    <Input
                      type="number"
                      value={availableNights}
                      onChange={(e) => setAvailableNights(Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                </div>

                {simulation && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex flex-col gap-1 mb-2">
                      <Badge variant="outline" className="w-fit text-[10px] font-bold uppercase tracking-wider">
                        {simulation.config.name}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground italic">
                        {simulation.config.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-primary/5 border">
                        <div className="flex justify-between items-start">
                          <p className="text-[10px] text-muted-foreground uppercase">Ocupação Est.</p>
                          <span className="text-[9px] font-bold text-primary">Teto: {(simulation.config.occMax * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-lg font-bold">{simulation.newOccupancy.toFixed(0)}%</p>
                        <p className="text-[9px] text-muted-foreground">Potencial: {simulation.config.potential}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-primary/5 border">
                        <p className="text-[10px] text-muted-foreground uppercase">Receita Proj.</p>
                        <p className="text-lg font-bold">R$ {simulation.newRevenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
                        <p className="text-[9px] text-muted-foreground">Eficiência: {((simulation.newOccupancy / (simulation.config.occMax * 100)) * 100).toFixed(0)}% do teto</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Atingimento da Meta</span>
                        <span className={simulation.goalAchievement >= 100 ? "text-success font-bold" : "text-muted-foreground"}>
                          {simulation.goalAchievement.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={simulation.goalAchievement} className="h-2" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mercado" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Monitoramento de Concorrência</h3>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2" size="sm">
                  <Plus className="h-4 w-4" /> Nova Cesta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Cesta de Concorrentes</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome da Cesta</Label>
                    <Input value={novaCesta.nome} onChange={(e) => setNovaCesta(p => ({ ...p, nome: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Concorrentes</Label>
                    {novaCesta.concorrentes.map((c, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={c} onChange={(e) => {
                          const n = [...novaCesta.concorrentes]; n[i] = e.target.value; setNovaCesta(p => ({ ...p, concorrentes: n }))
                        }} />
                        <Button variant="ghost" size="icon" onClick={() => removerConcorrente(i)}><X className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={adicionarConcorrente} className="w-full mt-2">+ Adicionar</Button>
                  </div>
                  <Button className="w-full" onClick={salvarCesta}>Salvar Cesta</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cestas.map((cesta) => (
              <Card key={cesta.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    {cesta.nome}
                    <Badge variant={cesta.nossaMedia > cesta.precoMedio ? "destructive" : "default"}>
                      {(((cesta.nossaMedia - cesta.precoMedio) / cesta.precoMedio) * 100).toFixed(1)}% vs comp
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preço Competidor</span>
                      <span className="font-bold">R$ {cesta.precoMedio}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nosso Preço</span>
                      <span className="font-bold border-b border-primary">R$ {cesta.nossaMedia}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Benchmarking por Região</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dadosComparativos}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="regiao" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="nossoPreco" fill="var(--primary)" name="Qavi" />
                    <Bar dataKey="concorrencia" fill="var(--success)" name="Mercado" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Market Share & Distribuição</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={distribuicaoPrecos} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="quantidade" label={({ faixa }: any) => faixa}>
                      {distribuicaoPrecos.map((entry, index) => <Cell key={index} fill={entry.cor} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
