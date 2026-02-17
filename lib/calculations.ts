import type { WebhookReserva, WebhookMeta } from "@/types"

// ============================================
// CALCULATION UTILITIES
// ============================================

export interface HistoricoMensal {
  mes_ano: string
  realizado: number
  meta: number
  percentualAtingimento: number
}

export function calculateHistoricoMensal(
  idpropriedade: string,
  reservas: WebhookReserva[],
  metas: WebhookMeta[]
): HistoricoMensal[] {
  const historico: HistoricoMensal[] = []

  // Agrupar reservas por mês/ano (usando checkout date como referência)
  const reservasPorMes = new Map<string, WebhookReserva[]>()

  reservas
    .filter((r) => r.idpropriedade === idpropriedade)
    .forEach((reserva) => {
      const checkoutDate = new Date(reserva.checkoutdate)
      const mesAno = `${String(checkoutDate.getMonth() + 1).padStart(2, "0")}-${checkoutDate.getFullYear()}`
      if (!reservasPorMes.has(mesAno)) {
        reservasPorMes.set(mesAno, [])
      }
      reservasPorMes.get(mesAno)!.push(reserva)
    })

  // Calcular histórico para cada mês
  reservasPorMes.forEach((reservasMes, mesAno) => {
    const realizado = reservasMes.reduce((sum, r) => sum + r.reservetotal, 0)

    // Buscar meta para este mês
    const [mes, ano] = mesAno.split("-")
    const metaDoMes = metas.find((m) => {
      if (!m.data_especifica) return false
      const metaDate = new Date(m.data_especifica)
      return (
        m.IdPropriedade === idpropriedade &&
        metaDate.getMonth() + 1 === Number.parseInt(mes) &&
        metaDate.getFullYear() === Number.parseInt(ano)
      )
    })

    const meta = metaDoMes?.meta || 0
    const percentualAtingimento = meta > 0 ? (realizado / meta) * 100 : 0

    historico.push({
      mes_ano: mesAno,
      realizado,
      meta,
      percentualAtingimento,
    })
  })

  // Ordenar por mês/ano (mais recente primeiro)
  return historico.sort((a, b) => {
    const [mesA, anoA] = a.mes_ano.split("-").map(Number)
    const [mesB, anoB] = b.mes_ano.split("-").map(Number)

    if (anoA !== anoB) return anoB - anoA
    return mesB - mesA
  })
}

export function calculateAntecedenciaMedia(reservas: WebhookReserva[]): number {
  if (reservas.length === 0) return 0

  const totalAntecedencia = reservas.reduce((sum, r) => sum + r.antecedencia_reserva, 0)
  return Math.round(totalAntecedencia / reservas.length)
}

export function calculateTicketMedio(reservas: WebhookReserva[]): number {
  if (reservas.length === 0) return 0

  const totalReceita = reservas.reduce((sum, r) => sum + r.reservetotal, 0)
  return totalReceita / reservas.length
}

export function calculateDiariasVendidas(reservas: WebhookReserva[]): number {
  return reservas.reduce((sum, r) => sum + r.nightcount, 0)
}

export function calculateReceitaTotal(reservas: WebhookReserva[]): number {
  return reservas.reduce((sum, r) => sum + r.reservetotal, 0)
}

export function calculateOcupacao(reservas: WebhookReserva[], diasNoMes: number): number {
  const diariasVendidas = calculateDiariasVendidas(reservas)
  return Math.min(100, (diariasVendidas / diasNoMes) * 100)
}

export function formatMesAnoDisplay(mesAno: string): string {
  const [mes, ano] = mesAno.split("-")
  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ]

  return `${meses[Number.parseInt(mes) - 1]} ${ano}`
}

// ============================================
// FORMATTING UTILITIES
// ============================================

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value)
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}

export function formatMesAno(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${month}-${year}`
}

export function parseDateString(dateStr: string): Date {
  // Handle ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + "T00:00:00")
  }

  // Handle DD-MM-YYYY format
  const [day, month, year] = dateStr.split("-")
  return new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
}

export function calculateAntecedencia(creationDate: Date, checkinDate: Date): number {
  const diffTime = checkinDate.getTime() - creationDate.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

export function formatDateBR(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("pt-BR")
}

export function formatDateTimeBR(date: Date): string {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function getDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function getMonthName(month: number): string {
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ]
  return months[month - 1] || ""
}

export function getShortMonthName(month: number): string {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return months[month - 1] || ""
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "A":
      return "bg-green-500"
    case "B":
      return "bg-blue-500"
    case "C":
      return "bg-yellow-500"
    case "D":
      return "bg-orange-500"
    case "E":
      return "bg-red-500"
    default:
      return "bg-gray-500"
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "A":
      return "Excelente"
    case "B":
      return "Bom"
    case "C":
      return "Regular"
    case "D":
      return "Atenção"
    case "E":
      return "Crítico"
    default:
      return "Desconhecido"
  }
}

export function getPriceStatusColor(status: string): string {
  switch (status) {
    case "underpriced":
      return "text-green-600 bg-green-100"
    case "overpriced":
      return "text-red-600 bg-red-100"
    case "optimal":
      return "text-blue-600 bg-blue-100"
    default:
      return "text-gray-600 bg-gray-100"
  }
}

export function getPriceStatusLabel(status: string): string {
  switch (status) {
    case "underpriced":
      return "Subprecificado"
    case "overpriced":
      return "Sobreprecificado"
    case "optimal":
      return "Ótimo"
    default:
      return "Desconhecido"
  }
}

export function getRevenueStatusColor(status: string): string {
  switch (status) {
    case "on-track":
      return "text-green-600 bg-green-100"
    case "at-risk":
      return "text-yellow-600 bg-yellow-100"
    case "behind":
      return "text-red-600 bg-red-100"
    default:
      return "text-gray-600 bg-gray-100"
  }
}

export function getRevenueStatusLabel(status: string): string {
  switch (status) {
    case "on-track":
      return "No caminho"
    case "at-risk":
      return "Em risco"
    case "behind":
      return "Atrasado"
    default:
      return "Desconhecido"
  }
}

// ============================================
// STATUS CALCULATIONS
// ============================================

export function calculatePropertyStatus(
  receitaCheckoutMes: number,
  metaMensal: number,
  metaMovel: number
): "A" | "B" | "C" | "D" | "E" {
  if (receitaCheckoutMes < 0.001) return "E"

  if (metaMensal > 0) {
    const percentualMetaMensal = (receitaCheckoutMes / metaMensal) * 100
    if (percentualMetaMensal >= 100) return "A"
  }

  if (metaMovel > 0) {
    const percentualMetaMovel = (receitaCheckoutMes / metaMovel) * 100
    if (percentualMetaMovel >= 90) return "B"
    if (percentualMetaMovel >= 50) return "C"
    return "D"
  }

  return "D"
}

// ============================================
// DATE CALCULATIONS
// ============================================

export function getMonthDateRange(date: Date = new Date()): {
  start: string
  end: string
  daysInMonth: number
  currentDay: number
} {
  const year = date.getFullYear()
  const month = date.getMonth()

  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    daysInMonth: end.getDate(),
    currentDay: date.getDate(),
  }
}

export function getWeekDateRange(date: Date = new Date()): {
  start: string
  end: string
} {
  const currentDay = date.getDay()
  const start = new Date(date)
  start.setDate(date.getDate() - currentDay)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  }
}

export function getDaysAgo(days: number, from: Date = new Date()): string {
  const date = new Date(from)
  date.setDate(date.getDate() - days)
  return date.toISOString().split("T")[0]
}

export function getNextWeekend(): {
  friday: string
  sunday: string
} {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7

  const friday = new Date(today)
  friday.setDate(today.getDate() + daysUntilFriday)

  const sunday = new Date(friday)
  sunday.setDate(friday.getDate() + 2)

  return {
    friday: friday.toISOString().split("T")[0],
    sunday: sunday.toISOString().split("T")[0],
  }
}
