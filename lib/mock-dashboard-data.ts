// ============================================
// MOCK DASHBOARD DATA
// Helper functions for dashboard components using the new mock data structure
// ============================================

import {
  mockIntegratedData,
  mockPropriedades,
  mockReservas,
  mockMetas,
  mockSalesGoals,
  mockCotacoes,
  mockGoogleTrends,
  mockReviews,
  mockAirbnbExtracoes,
  mockCalendarListings,
  mockOcupacao,
} from "@/lib/mock-data"

// ============================================
// COMMAND CENTER METRICS
// ============================================
export function getMockCommandCenterMetrics() {
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const daysInMonth = endOfMonth.getDate()
  const currentDay = today.getDate()
  const daysRemaining = daysInMonth - currentDay

  const startOfMonthStr = startOfMonth.toISOString().split("T")[0]
  const todayStr = today.toISOString().split("T")[0]
  const endOfMonthStr = endOfMonth.toISOString().split("T")[0]

  let revenueMTD = 0
  let revenueTarget = 0
  let unitsAtRisk = 0
  let totalSales = 0

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0]

  mockIntegratedData.forEach((unit) => {
    // Calculate MTD revenue (checkout-based as per schema)
    const mtdSales = unit.reservas.filter(
      (r) => r.checkoutdate >= startOfMonthStr && r.checkoutdate <= todayStr
    )
    revenueMTD += mtdSales.reduce((sum, r) => sum + r.reservetotal, 0)
    totalSales += mtdSales.length

    // Calculate target from metas
    revenueTarget += unit.metricas.metaMensal

    // Check for units at risk (no sales in last 7 days)
    const recentSales = unit.reservas.filter((r) => r.creationdate >= sevenDaysAgoStr)
    if (recentSales.length === 0) {
      unitsAtRisk++
    }
  })

  const percentOfTarget = revenueTarget > 0 ? (revenueMTD / revenueTarget) * 100 : 0
  const remainingTarget = Math.max(0, revenueTarget - revenueMTD)
  const dailyPaceRequired = daysRemaining > 0 ? remainingTarget / daysRemaining : 0

  // Calculate next weekend occupancy
  const nextFriday = new Date()
  const dayOfWeek = nextFriday.getDay()
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7
  nextFriday.setDate(nextFriday.getDate() + daysUntilFriday)
  const nextSunday = new Date(nextFriday)
  nextSunday.setDate(nextSunday.getDate() + 2)
  const nextFridayStr = nextFriday.toISOString().split("T")[0]
  const nextSundayStr = nextSunday.toISOString().split("T")[0]

  const occupiedUnits = mockIntegratedData.filter((unit) =>
    unit.reservas.some((r) => r.checkindate <= nextSundayStr && r.checkoutdate >= nextFridayStr)
  ).length

  const nextWeekendOccupancy =
    mockIntegratedData.length > 0 ? (occupiedUnits / mockIntegratedData.length) * 100 : 0

  return {
    revenueMTD,
    revenueTarget,
    percentOfTarget,
    dailyPaceRequired,
    unitsAtRisk,
    nextWeekendOccupancy,
    daysRemaining,
    daysInMonth,
    currentDay,
    totalSales,
    ticketMedio: totalSales > 0 ? revenueMTD / totalSales : 0,
  }
}

// ============================================
// ALERTS
// ============================================
export function getMockAlerts() {
  const alerts: Array<{
    id: string
    type: "no-sale" | "excess-sales" | "critical-weekend"
    message: string
    unitName: string
    severity: "high" | "medium" | "low"
    link: string
  }> = []

  const today = new Date()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0]
  const todayStr = today.toISOString().split("T")[0]

  mockIntegratedData.forEach((unit) => {
    const recentSales = unit.reservas.filter((r) => r.creationdate >= sevenDaysAgoStr)
    const allSales = unit.reservas.filter((r) => r.creationdate <= todayStr)
    const lastSale = allSales.sort(
      (a, b) => new Date(b.creationdate).getTime() - new Date(a.creationdate).getTime()
    )[0]

    if (!lastSale || lastSale.creationdate < sevenDaysAgoStr) {
      const daysSinceLastSale = lastSale
        ? Math.floor(
          (today.getTime() - new Date(lastSale.creationdate).getTime()) / (1000 * 60 * 60 * 24)
        )
        : 30

      alerts.push({
        id: `no-sale-${unit.propriedade.idpropriedade}`,
        type: "no-sale",
        message: `${daysSinceLastSale > 30 ? "Mais de 30" : daysSinceLastSale} dias sem venda`,
        unitName: unit.propriedade.nomepropriedade,
        severity: daysSinceLastSale > 14 ? "high" : "medium",
        link: "/operations",
      })
    }

    if (recentSales.length >= 2) {
      alerts.push({
        id: `excess-${unit.propriedade.idpropriedade}`,
        type: "excess-sales",
        message: `${recentSales.length} vendas nos ultimos 7 dias - verificar preco`,
        unitName: unit.propriedade.nomepropriedade,
        severity: "medium",
        link: "/pricing",
      })
    }
  })

  return alerts.slice(0, 15)
}

// ============================================
// CHART DATA
// ============================================
export function getMockChartData() {
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const daysInMonth = endOfMonth.getDate()
  const currentDay = today.getDate()

  const metrics = getMockCommandCenterMetrics()
  const dailyTarget = metrics.revenueTarget / daysInMonth

  const chartData = []
  let accumulated = 0

  for (let dia = 1; dia <= daysInMonth; dia++) {
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`

    // Sum all checkout revenue for this day
    const vendaDia = mockReservas
      .filter((r) => r.checkoutdate === dateStr)
      .reduce((sum, r) => sum + r.reservetotal, 0)

    if (dia <= currentDay) {
      accumulated += vendaDia
    }

    chartData.push({
      dia,
      realizado: dia <= currentDay ? accumulated : null,
      meta: dailyTarget * dia,
    })
  }

  return chartData
}

// ============================================
// PRICING DATA
// ============================================
export function getMockPricingData() {
  const today = new Date()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0]
  const todayStr = today.toISOString().split("T")[0]

  return mockIntegratedData.map((unit) => {
    const recentSales = unit.reservas.filter((r) => r.creationdate >= sevenDaysAgoStr)
    const allSales = unit.reservas.filter((r) => r.creationdate <= todayStr)
    const lastSale = allSales.sort(
      (a, b) => new Date(b.creationdate).getTime() - new Date(a.creationdate).getTime()
    )[0]

    const lastSaleDays = lastSale
      ? Math.floor(
        (today.getTime() - new Date(lastSale.creationdate).getTime()) / (1000 * 60 * 60 * 24)
      )
      : 999

    const avgPrice =
      unit.reservas.length > 0
        ? unit.reservas.reduce((sum, r) => sum + r.pricepernight, 0) / unit.reservas.length
        : 300

    // Get current price from calendar listings
    const currentListing = mockCalendarListings.find(
      (l) => l.id === unit.propriedade.idpropriedade && l.from <= todayStr && l.to >= todayStr
    )
    const currentPrice = currentListing?.baseratevalue || avgPrice

    const optimalPrice = unit.salesGoals ? unit.salesGoals.mvenda_mensal / 14 : avgPrice * 1.1
    const totalNights = unit.reservas.reduce((sum, r) => sum + r.nightcount, 0)
    const occupancy = Math.min(100, (totalNights / 30) * 100)
    const revenue = unit.reservas.reduce((sum, r) => sum + r.reservetotal, 0)

    let status: "underpriced" | "overpriced" | "optimal" = "optimal"
    if (lastSaleDays >= 7) {
      status = "overpriced"
    } else if (recentSales.length >= 2) {
      status = "underpriced"
    }

    return {
      id: unit.propriedade.idpropriedade,
      name: unit.propriedade.nomepropriedade,
      praca: unit.propriedade.praca,
      grupo: unit.propriedade.grupo_nome,
      currentPrice,
      optimalPrice,
      occupancy,
      revenue,
      lastSaleDays,
      salesLast7Days: recentSales.length,
      status,
    }
  })
}

// ============================================
// REVENUE DATA
// ============================================
export function getMockRevenueData() {
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const daysInMonth = endOfMonth.getDate()
  const currentDay = today.getDate()
  const startOfMonthStr = startOfMonth.toISOString().split("T")[0]
  const todayStr = today.toISOString().split("T")[0]

  return mockIntegratedData.map((unit) => {
    const target = unit.metricas.metaMensal
    const revenue = unit.reservas
      .filter((r) => r.checkoutdate >= startOfMonthStr && r.checkoutdate <= todayStr)
      .reduce((sum, r) => sum + r.reservetotal, 0)

    const percentAchieved = target > 0 ? (revenue / target) * 100 : 0
    const expectedPercent = (currentDay / daysInMonth) * 100

    let status: "on-track" | "at-risk" | "behind" = "on-track"
    if (percentAchieved < expectedPercent * 0.7) {
      status = "behind"
    } else if (percentAchieved < expectedPercent * 0.9) {
      status = "at-risk"
    }

    return {
      id: unit.propriedade.idpropriedade,
      name: unit.propriedade.nomepropriedade,
      praca: unit.propriedade.praca,
      grupo: unit.propriedade.grupo_nome,
      target,
      revenue,
      percentAchieved,
      status,
    }
  })
}

// ============================================
// AVAILABILITY DATA
// ============================================
export function getMockAvailabilityData() {
  const today = new Date()
  const nextFriday = new Date()
  const dayOfWeek = nextFriday.getDay()
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7
  nextFriday.setDate(nextFriday.getDate() + daysUntilFriday)
  const nextSunday = new Date(nextFriday)
  nextSunday.setDate(nextSunday.getDate() + 2)
  const nextFridayStr = nextFriday.toISOString().split("T")[0]
  const nextSundayStr = nextSunday.toISOString().split("T")[0]

  return mockIntegratedData.map((unit) => {
    const isBooked = unit.reservas.some(
      (r) => r.checkindate <= nextSundayStr && r.checkoutdate >= nextFridayStr
    )

    const avgPrice =
      unit.reservas.length > 0
        ? unit.reservas.reduce((sum, r) => sum + r.pricepernight, 0) / unit.reservas.length
        : 300

    let availableNights = 0
    for (let i = 0; i < 14; i++) {
      const checkDate = new Date()
      checkDate.setDate(checkDate.getDate() + i)
      const checkDateStr = checkDate.toISOString().split("T")[0]
      const dow = checkDate.getDay()

      if (dow === 5 || dow === 6 || dow === 0) {
        const isBookedOnDate = unit.reservas.some(
          (r) => r.checkindate <= checkDateStr && r.checkoutdate > checkDateStr
        )

        if (!isBookedOnDate) {
          availableNights++
        }
      }
    }

    return {
      id: unit.propriedade.idpropriedade,
      name: unit.propriedade.nomepropriedade,
      praca: unit.propriedade.praca,
      grupo: unit.propriedade.grupo_nome,
      availableNightsFriSun: availableNights,
      avgPrice,
      potentialRevenue: availableNights * avgPrice,
      isAvailableNextWeekend: !isBooked,
    }
  })
}

// ============================================
// ABNORMAL DATA (Properties with pricing issues)
// ============================================
export function getMockAbnormalData() {
  const today = new Date()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0]
  const todayStr = today.toISOString().split("T")[0]

  return mockIntegratedData.map((unit) => {
    const recentSales = unit.reservas.filter((r) => r.creationdate >= sevenDaysAgoStr)
    const allSales = unit.reservas.filter((r) => r.creationdate <= todayStr)
    const lastSale = allSales.sort(
      (a, b) => new Date(b.creationdate).getTime() - new Date(a.creationdate).getTime()
    )[0]

    const lastSaleDate = lastSale ? lastSale.creationdate : null
    const daysSinceLastSale = lastSale
      ? Math.floor(
        (today.getTime() - new Date(lastSale.creationdate).getTime()) / (1000 * 60 * 60 * 24)
      )
      : 999

    const currentPrice =
      unit.reservas.length > 0
        ? unit.reservas.reduce((sum, r) => sum + r.pricepernight, 0) / unit.reservas.length
        : 300

    const optimalPrice = unit.salesGoals ? unit.salesGoals.mvenda_mensal / 14 : currentPrice * 1.1

    let status: "overpriced" | "underpriced" | "normal" = "normal"
    let suggestedAction = "Manter preco atual"

    if (daysSinceLastSale >= 7) {
      status = "overpriced"
      suggestedAction = "Diminuir preco - Sem vendas ha mais de 7 dias"
    } else if (recentSales.length >= 2) {
      status = "underpriced"
      suggestedAction = "Aumentar preco - 2+ vendas nos ultimos 7 dias"
    }

    return {
      id: unit.propriedade.idpropriedade,
      name: unit.propriedade.nomepropriedade,
      praca: unit.propriedade.praca,
      grupo: unit.propriedade.grupo_nome,
      lastSaleDate,
      daysSinceLastSale,
      salesLast7Days: recentSales.length,
      currentPrice,
      optimalPrice,
      status,
      suggestedAction,
    }
  })
}

// ============================================
// SALES DEMAND DATA
// ============================================
export function getMockSalesDemandData() {
  const today = new Date()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0]
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]

  let totalSales7Days = 0
  let totalSales30Days = 0
  let totalRevenue30Days = 0

  const partnerStats: Record<string, { sales: number; revenue: number }> = {}

  mockReservas.forEach((r) => {
    if (r.creationdate >= thirtyDaysAgoStr) {
      totalSales30Days++
      totalRevenue30Days += r.reservetotal

      const partner = r.partnername
      if (!partnerStats[partner]) {
        partnerStats[partner] = { sales: 0, revenue: 0 }
      }
      partnerStats[partner].sales++
      partnerStats[partner].revenue += r.reservetotal

      if (r.creationdate >= sevenDaysAgoStr) {
        totalSales7Days++
      }
    }
  })

  // Simulate quotes based on cotacoes mock data
  const totalQuotes7Days = mockCotacoes.filter(
    (c) => c.data_cotacao >= sevenDaysAgoStr
  ).length
  const totalQuotes30Days = mockCotacoes.filter(
    (c) => c.data_cotacao >= thirtyDaysAgoStr
  ).length

  const partnerArray = Object.entries(partnerStats).map(([name, stats]) => ({
    name,
    sales: stats.sales,
    revenue: stats.revenue,
    avgTicket: stats.sales > 0 ? stats.revenue / stats.sales : 0,
    conversionRate: Math.round(25 + Math.random() * 15),
  }))
  partnerArray.sort((a, b) => b.revenue - a.revenue)

  // Google Trends index
  const recentTrends = mockGoogleTrends.filter((t) => t.data >= sevenDaysAgoStr)
  const avgTrendsIndex =
    recentTrends.length > 0
      ? recentTrends.reduce((sum, t) => sum + t.indice, 0) / recentTrends.length
      : 50

  return {
    metrics: {
      totalQuotes7Days,
      totalQuotes30Days,
      conversionRate: totalQuotes30Days > 0 ? (totalSales30Days / totalQuotes30Days) * 100 : 0,
      revenuePerQuote: totalQuotes30Days > 0 ? totalRevenue30Days / totalQuotes30Days : 0,
      searchInterestIndex: Math.round(avgTrendsIndex),
    },
    partnerData: partnerArray,
  }
}

// ============================================
// SYSTEM METRICS
// ============================================
export function getMockSystemMetrics() {
  return {
    lastSuccessfulSync: new Date(),
    webhookStatus: "connected" as const,
    dataFreshness: 5,
    errorRate: 0,
    totalProperties: mockPropriedades.length,
    totalReservations: mockReservas.length,
    totalMetas: mockMetas.length,
    totalSalesGoals: mockSalesGoals.length,
    totalCotacoes: mockCotacoes.length,
    totalReviews: mockReviews.length,
  }
}

// ============================================
// SYSTEM LOGS
// ============================================
export function getMockLogs() {
  const now = new Date()
  return [
    {
      id: "log-1",
      timestamp: now,
      type: "success" as const,
      message: "Dados mock carregados com sucesso",
      details: `${mockPropriedades.length} propriedades, ${mockReservas.length} reservas`,
    },
    {
      id: "log-2",
      timestamp: new Date(now.getTime() - 60 * 60 * 1000),
      type: "success" as const,
      message: "Sincronizacao automatica",
      details: "Duracao: 0.5s (mock)",
    },
    {
      id: "log-3",
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      type: "success" as const,
      message: "Sincronizacao automatica",
      details: "Duracao: 0.5s (mock)",
    },
    {
      id: "log-4",
      timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      type: "info" as const,
      message: "Sistema usando dados mock",
      details: "Webhooks desabilitados",
    },
    {
      id: "log-5",
      timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      type: "success" as const,
      message: "Inicializacao do sistema",
      details: "Dados mock carregados",
    },
  ]
}

// ============================================
// DAILY SALES RANKING
// ============================================
export function getMockDailySalesRanking() {
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]

  return mockIntegratedData
    .map((unit) => {
      const todaySales = unit.reservas.filter((r) => r.creationdate === todayStr)
      const todayRevenue = todaySales.reduce((sum, r) => sum + r.reservetotal, 0)

      return {
        id: unit.propriedade.idpropriedade,
        name: unit.propriedade.nomepropriedade,
        praca: unit.propriedade.praca,
        salesCount: todaySales.length,
        revenue: todayRevenue,
      }
    })
    .filter((unit) => unit.salesCount > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
}

// ============================================
// PARTNER SALES RANKING
// ============================================
export function getMockPartnerSalesRanking() {
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const startOfMonthStr = startOfMonth.toISOString().split("T")[0]

  const partnerStats = new Map<string, { sales: number; revenue: number; diarias: number }>()

  mockReservas
    .filter((r) => r.creationdate >= startOfMonthStr)
    .forEach((r) => {
      const partner = r.partnername
      if (!partnerStats.has(partner)) {
        partnerStats.set(partner, { sales: 0, revenue: 0, diarias: 0 })
      }
      const stats = partnerStats.get(partner)!
      stats.sales++
      stats.revenue += r.reservetotal
      stats.diarias += r.nightcount
    })

  return Array.from(partnerStats.entries())
    .map(([name, stats]) => ({
      name,
      sales: stats.sales,
      revenue: stats.revenue,
      diarias: stats.diarias,
      ticketMedio: stats.sales > 0 ? stats.revenue / stats.sales : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

// ============================================
// COTACOES DATA
// ============================================
export function getMockCotacoesData() {
  const today = new Date()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0]

  // Aggregate by origin
  const byOrigin = new Map<string, { total: number; converted: number; value: number }>()

  mockCotacoes
    .filter((c) => c.data_cotacao >= sevenDaysAgoStr)
    .forEach((c) => {
      if (!byOrigin.has(c.origem)) {
        byOrigin.set(c.origem, { total: 0, converted: 0, value: 0 })
      }
      const stats = byOrigin.get(c.origem)!
      stats.total++
      if (c.convertida) {
        stats.converted++
        stats.value += c.valor_estimado
      }
    })

  // Aggregate by destination
  const byDestino = new Map<string, { total: number; converted: number; value: number }>()

  mockCotacoes
    .filter((c) => c.data_cotacao >= sevenDaysAgoStr)
    .forEach((c) => {
      if (!byDestino.has(c.destino)) {
        byDestino.set(c.destino, { total: 0, converted: 0, value: 0 })
      }
      const stats = byDestino.get(c.destino)!
      stats.total++
      if (c.convertida) {
        stats.converted++
        stats.value += c.valor_estimado
      }
    })

  return {
    byOrigin: Array.from(byOrigin.entries())
      .map(([name, stats]) => ({
        name,
        ...stats,
        conversionRate: stats.total > 0 ? (stats.converted / stats.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total),
    byDestino: Array.from(byDestino.entries())
      .map(([name, stats]) => ({
        name,
        ...stats,
        conversionRate: stats.total > 0 ? (stats.converted / stats.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total),
  }
}

// ============================================
// REVIEWS DATA
// ============================================
export function getMockReviewsData() {
  const reviewsByProperty = new Map<
    string,
    { count: number; totalRating: number; channels: Set<string> }
  >()

  mockReviews.forEach((r) => {
    if (!reviewsByProperty.has(r.idPropriedade)) {
      reviewsByProperty.set(r.idPropriedade, { count: 0, totalRating: 0, channels: new Set() })
    }
    const stats = reviewsByProperty.get(r.idPropriedade)!
    stats.count++
    stats.totalRating += r.Avaliacao
    stats.channels.add(r.ExternalChannelName)
  })

  return Array.from(reviewsByProperty.entries())
    .map(([propId, stats]) => {
      const property = mockPropriedades.find((p) => p.idpropriedade === propId)
      return {
        id: propId,
        name: property?.nomepropriedade || propId,
        reviewCount: stats.count,
        avgRating: stats.count > 0 ? stats.totalRating / stats.count : 0,
        channels: Array.from(stats.channels),
      }
    })
    .sort((a, b) => b.avgRating - a.avgRating)
}

// ============================================
// COMPETITIVE INTELLIGENCE (Airbnb Extractions)
// ============================================
export function getMockCompetitiveData() {
  const latestExtraction = mockAirbnbExtracoes[0]?.data_extracao
  const latestData = mockAirbnbExtracoes.filter((e) => e.data_extracao === latestExtraction)

  const avgPrice =
    latestData.length > 0
      ? latestData.reduce((sum, e) => sum + e.preco_total / e.quantidade_noites, 0) / latestData.length
      : 0

  const avgRating =
    latestData.filter((e) => e.media_avaliacao !== "N/A").length > 0
      ? latestData
        .filter((e) => e.media_avaliacao !== "N/A")
        .reduce((sum, e) => sum + Number.parseFloat(e.media_avaliacao), 0) /
      latestData.filter((e) => e.media_avaliacao !== "N/A").length
      : 0

  const preferredCount = latestData.filter((e) => e.preferido_hospedes).length

  return {
    totalListings: latestData.length,
    avgPricePerNight: avgPrice,
    avgRating,
    preferredPercentage: latestData.length > 0 ? (preferredCount / latestData.length) * 100 : 0,
    byType: Object.entries(
      latestData.reduce(
        (acc, e) => {
          acc[e.tipo_propriedade] = (acc[e.tipo_propriedade] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
    ).map(([type, count]) => ({ type, count })),
    lastExtraction: latestExtraction,
  }
}
