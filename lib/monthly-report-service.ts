/**
 * Monthly Report Service
 *
 * Aggregates IntegratedData into a forward-looking monthly report payload.
 * Used by /api/reports/monthly/[mes] and consumed by the dashboard at
 * /relatorios/mensal/[mes].
 */

import { getIntegratedDataFromBigQuery } from './bigquery-service'
import { calculatePropertyStatus } from './calculations'
import type {
  IntegratedData,
  WebhookReserva,
  MonthlyReportPayload,
  DimensionRow,
  QuickWin,
  OccupancyRow,
  OccupancyDayStatus,
  Gap,
  RankRow,
  PickupPoint,
} from '@/types'

const MES_RE = /^\d{4}-\d{2}$/

export function isValidMes(mes: string): boolean {
  return MES_RE.test(mes)
}

function getMonthBounds(mes: string): { start: Date; end: Date; daysInMonth: number; year: number; month: number } {
  const [yearStr, monthStr] = mes.split('-')
  const year = Number.parseInt(yearStr, 10)
  const month = Number.parseInt(monthStr, 10)
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))
  return { start, end, daysInMonth: end.getUTCDate(), year, month }
}

function ymd(d: Date): string {
  return d.toISOString().split('T')[0]
}

function reservaInMonth(r: WebhookReserva, mes: string): boolean {
  return typeof r.checkindate === 'string' && r.checkindate.startsWith(mes)
}

function nightsOfReservaInMonth(r: WebhookReserva, mes: string): number {
  if (!r.checkindate || !r.checkoutdate) return 0
  const { start, end } = getMonthBounds(mes)
  const ci = new Date(r.checkindate + 'T00:00:00Z')
  const co = new Date(r.checkoutdate + 'T00:00:00Z')
  const monthEnd = new Date(end)
  monthEnd.setUTCDate(monthEnd.getUTCDate() + 1)
  const overlapStart = ci > start ? ci : start
  const overlapEnd = co < monthEnd ? co : monthEnd
  const diff = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86_400_000)
  return Math.max(0, diff)
}

function getMetaForMonth(item: IntegratedData, mes: string): { meta: number; metaMovel: number } {
  const metas = (item.metas || []).filter((m) => String(m.data_especifica || '').startsWith(mes))
  const meta = metas.reduce((s, m) => s + (Number(m.meta) || 0), 0)
  const metaMovel = metas.reduce((s, m) => s + (Number(m.meta_movel) || 0), 0)
  return { meta, metaMovel }
}

function emptyDimRow(key: string): DimensionRow {
  return {
    key,
    otb: 0,
    meta: 0,
    metaMovel: 0,
    gap: 0,
    pctMeta: 0,
    status: 'E',
    nProps: 0,
    nReservas: 0,
    noites: 0,
  }
}

function aggregateByDimension(
  data: IntegratedData[],
  dim: 'praca' | 'grupo_nome',
  mes: string
): DimensionRow[] {
  const map = new Map<string, DimensionRow>()
  for (const item of data) {
    const key = (item.propriedade as any)[dim] || '—'
    if (!map.has(key)) map.set(key, emptyDimRow(key))
    const row = map.get(key)!
    const { meta, metaMovel } = getMetaForMonth(item, mes)
    const reservasMes = item.reservas.filter((r) => reservaInMonth(r, mes))
    const otb = reservasMes.reduce((s, r) => s + (Number(r.reservetotal) || 0), 0)
    const noites = reservasMes.reduce((s, r) => s + (Number(r.nightcount) || 0), 0)
    row.otb += otb
    row.meta += meta
    row.metaMovel += metaMovel
    row.nProps += 1
    row.nReservas += reservasMes.length
    row.noites += noites
  }
  return Array.from(map.values())
    .map((row) => {
      row.gap = row.meta - row.otb
      row.pctMeta = row.meta > 0 ? (row.otb / row.meta) * 100 : 0
      row.status = calculatePropertyStatus(row.otb, row.meta, row.metaMovel)
      return row
    })
    .sort((a, b) => b.otb - a.otb)
}

function aggregateByCanal(
  data: IntegratedData[],
  mes: string
): Array<{ canal: string; receita: number; reservas: number; share: number }> {
  const map = new Map<string, { receita: number; reservas: number }>()
  let total = 0
  for (const item of data) {
    for (const r of item.reservas) {
      if (!reservaInMonth(r, mes)) continue
      const key = r.partnername || '—'
      if (!map.has(key)) map.set(key, { receita: 0, reservas: 0 })
      const entry = map.get(key)!
      entry.receita += Number(r.reservetotal) || 0
      entry.reservas += 1
      total += Number(r.reservetotal) || 0
    }
  }
  return Array.from(map.entries())
    .map(([canal, v]) => ({
      canal,
      receita: v.receita,
      reservas: v.reservas,
      share: total > 0 ? (v.receita / total) * 100 : 0,
    }))
    .sort((a, b) => b.receita - a.receita)
}

function buildOccupancyMatrix(data: IntegratedData[], mes: string): OccupancyRow[] {
  const { start, end, daysInMonth } = getMonthBounds(mes)

  return data.map((item) => {
    const dias: Array<{ date: string; status: OccupancyDayStatus }> = []
    let noitesVendidas = 0
    let noitesBloqueadas = 0
    let noitesDisponiveis = 0

    const ocupacaoMap = new Map<string, OccupancyDayStatus>()
    for (const o of item.ocupacao || []) {
      if (!o.datas?.startsWith(mes)) continue
      let status: OccupancyDayStatus = 'disponivel'
      if (o.ocupado === 1) status = 'ocupado'
      else if (o.manutencao === 1) status = 'manutencao'
      else if (o.ocupado_proprietario === 1) status = 'block'
      ocupacaoMap.set(o.datas, status)
    }

    const reservaDays = new Set<string>()
    for (const r of item.reservas) {
      if (!r.checkindate || !r.checkoutdate) continue
      const ci = new Date(r.checkindate + 'T00:00:00Z')
      const co = new Date(r.checkoutdate + 'T00:00:00Z')
      for (let d = new Date(ci); d < co; d.setUTCDate(d.getUTCDate() + 1)) {
        if (d >= start && d <= end) reservaDays.add(ymd(d))
      }
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${mes}-${String(d).padStart(2, '0')}`
      let status = ocupacaoMap.get(date)
      if (!status) {
        status = reservaDays.has(date) ? 'ocupado' : 'disponivel'
      }
      dias.push({ date, status })
      if (status === 'ocupado') noitesVendidas++
      else if (status === 'manutencao' || status === 'block') noitesBloqueadas++
      else noitesDisponiveis++
    }

    const { meta, metaMovel } = getMetaForMonth(item, mes)
    const otb = item.reservas
      .filter((r) => reservaInMonth(r, mes))
      .reduce((s, r) => s + (Number(r.reservetotal) || 0), 0)
    const status = calculatePropertyStatus(otb, meta, metaMovel)

    return {
      propertyId: item.propriedade.idpropriedade,
      nome: item.propriedade.nomepropriedade,
      praca: item.propriedade.praca || '—',
      grupo_nome: item.propriedade.grupo_nome || '—',
      status,
      dias,
      noitesVendidas,
      noitesDisponiveis,
      noitesBloqueadas,
      ocupacaoPct: daysInMonth > 0 ? Math.round((noitesVendidas / daysInMonth) * 100) : 0,
    }
  })
}

function detectGaps(matrix: OccupancyRow[]): Gap[] {
  const gaps: Gap[] = []
  for (const row of matrix) {
    let runStart: string | null = null
    let runLength = 0
    let weekendDays = 0

    const flush = (endDate: string) => {
      if (runStart && runLength > 0) {
        let tipo: Gap['tipo']
        if (weekendDays > 0 && runLength <= 3) tipo = 'fds_livre'
        else if (runLength >= 3 && runLength <= 5) tipo = 'intervalo_3a5'
        else if (runLength > 5) tipo = 'intervalo_longo'
        else return

        gaps.push({
          propertyId: row.propertyId,
          nome: row.nome,
          praca: row.praca,
          tipo,
          inicio: runStart,
          fim: endDate,
          nights: runLength,
        })
      }
    }

    for (let i = 0; i < row.dias.length; i++) {
      const day = row.dias[i]
      const dt = new Date(day.date + 'T00:00:00Z')
      const dow = dt.getUTCDay()
      if (day.status === 'disponivel') {
        if (!runStart) {
          runStart = day.date
          runLength = 0
          weekendDays = 0
        }
        runLength++
        if (dow === 0 || dow === 5 || dow === 6) weekendDays++
      } else {
        if (runStart) flush(row.dias[i - 1]?.date || day.date)
        runStart = null
        runLength = 0
        weekendDays = 0
      }
    }
    if (runStart) flush(row.dias[row.dias.length - 1].date)
  }
  return gaps
}

function calculatePickup(data: IntegratedData[], mes: string, baselineYear: number): {
  atual: PickupPoint[]
  baseline: PickupPoint[]
  baselineYear: number
} {
  const [, monthStr] = mes.split('-')
  const baselineMes = `${baselineYear}-${monthStr}`

  const buildCurve = (filterMes: string): PickupPoint[] => {
    const [yStr, mStr] = filterMes.split('-')
    const monthStart = new Date(Date.UTC(Number.parseInt(yStr, 10), Number.parseInt(mStr, 10) - 1, 1))

    const byCreationDay = new Map<string, { receita: number; reservas: number }>()
    for (const item of data) {
      for (const r of item.reservas) {
        if (!r.checkindate?.startsWith(filterMes)) continue
        if (!r.creationdate) continue
        const key = r.creationdate
        if (!byCreationDay.has(key)) byCreationDay.set(key, { receita: 0, reservas: 0 })
        const e = byCreationDay.get(key)!
        e.receita += Number(r.reservetotal) || 0
        e.reservas += 1
      }
    }
    const sorted = Array.from(byCreationDay.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    let cumul = 0
    let cumulRes = 0
    return sorted.map(([date, v]) => {
      cumul += v.receita
      cumulRes += v.reservas
      const dt = new Date(date + 'T00:00:00Z')
      const offset = Math.round((dt.getTime() - monthStart.getTime()) / 86_400_000)
      return { date, offset, cumulativo: cumul, reservas: cumulRes }
    })
  }

  return {
    atual: buildCurve(mes),
    baseline: buildCurve(baselineMes),
    baselineYear,
  }
}

function buildRankings(data: IntegratedData[], mes: string): {
  topOTB: RankRow[]
  overMeta: RankRow[]
  emRisco: RankRow[]
} {
  const rows: RankRow[] = data.map((item) => {
    const reservasMes = item.reservas.filter((r) => reservaInMonth(r, mes))
    const otb = reservasMes.reduce((s, r) => s + (Number(r.reservetotal) || 0), 0)
    const { meta, metaMovel } = getMetaForMonth(item, mes)
    const status = calculatePropertyStatus(otb, meta, metaMovel)
    return {
      propertyId: item.propriedade.idpropriedade,
      nome: item.propriedade.nomepropriedade,
      praca: item.propriedade.praca || '—',
      grupo_nome: item.propriedade.grupo_nome || '—',
      otb,
      meta,
      gap: meta - otb,
      pctMeta: meta > 0 ? (otb / meta) * 100 : 0,
      status,
      nReservas: reservasMes.length,
      ticketMedio: reservasMes.length > 0 ? otb / reservasMes.length : 0,
    }
  })

  const topOTB = [...rows].sort((a, b) => b.otb - a.otb).slice(0, 10)
  const overMeta = [...rows]
    .filter((r) => r.meta > 0 && r.otb >= r.meta)
    .sort((a, b) => b.pctMeta - a.pctMeta)
    .slice(0, 10)
  const emRisco = [...rows]
    .filter((r) => r.meta > 0 && r.pctMeta < 50)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 10)

  return { topOTB, overMeta, emRisco }
}

function detectQuickWins(
  data: IntegratedData[],
  mes: string,
  matrix: OccupancyRow[]
): QuickWin[] {
  const matrixById = new Map(matrix.map((r) => [r.propertyId, r]))
  const wins: QuickWin[] = []
  const { daysInMonth } = getMonthBounds(mes)

  for (const item of data) {
    const id = item.propriedade.idpropriedade
    const reservasMes = item.reservas.filter((r) => reservaInMonth(r, mes))
    const otb = reservasMes.reduce((s, r) => s + (Number(r.reservetotal) || 0), 0)
    const { meta, metaMovel } = getMetaForMonth(item, mes)
    if (meta <= 0) continue

    const occRow = matrixById.get(id)
    if (!occRow) continue
    const noitesVendidas = occRow.noitesVendidas
    const noitesDisponiveis = occRow.noitesDisponiveis
    const ocupacaoOTB = daysInMonth > 0 ? (noitesVendidas / daysInMonth) * 100 : 0
    const teto = 18
    const noitesRestantesNoTeto = Math.max(0, teto - noitesVendidas)
    const noitesParaVendaEfetiva = Math.min(noitesDisponiveis, noitesRestantesNoTeto)

    const gap = meta - otb
    const precoAtual = Number((item.propriedade as any).valor_tarifario) || 0
    const precoMin = meta / 20
    const precoSugerido = noitesParaVendaEfetiva > 0
      ? Math.max(gap / noitesParaVendaEfetiva, precoMin)
      : precoMin
    const status = calculatePropertyStatus(otb, meta, metaMovel)

    let phs = 50
    if (gap <= 0) phs = 95
    else if (ocupacaoOTB >= 70 && precoAtual > 0 && precoAtual < precoSugerido * 0.85) phs = 30
    else if (ocupacaoOTB < 30 && precoAtual > 0 && precoAtual > precoSugerido * 1.15) phs = 35
    else if (ocupacaoOTB >= 50 && precoAtual >= precoSugerido * 0.9 && precoAtual <= precoSugerido * 1.1) phs = 75
    else phs = 55

    let tipo: QuickWin['tipo']
    let recomendacao: string
    let impactoR$: number
    let prioridade: 1 | 2 | 3

    if (gap <= 0) {
      continue
    } else if (ocupacaoOTB >= 70 && precoAtual > 0 && precoAtual < precoSugerido * 0.85) {
      tipo = 'UNDERPRICED'
      const novo = Math.max(precoSugerido, precoAtual * 1.15)
      const delta = novo - precoAtual
      impactoR$ = delta * Math.max(noitesParaVendaEfetiva, 1)
      recomendacao = `Subir preço de R$ ${precoAtual.toFixed(0)} para ~R$ ${novo.toFixed(0)} (ocupação ${ocupacaoOTB.toFixed(0)}% já alta).`
      prioridade = 1
    } else if (ocupacaoOTB < 30 && precoAtual > 0 && precoAtual > precoSugerido * 1.15) {
      tipo = 'OVERPRICED'
      const novo = Math.max(precoSugerido, precoMin)
      impactoR$ = novo * Math.max(noitesParaVendaEfetiva, 1) * 0.4
      recomendacao = `Reduzir preço de R$ ${precoAtual.toFixed(0)} para ~R$ ${novo.toFixed(0)} (ocupação ${ocupacaoOTB.toFixed(0)}% baixa).`
      prioridade = 1
    } else if (status === 'C' || status === 'D' || status === 'E') {
      tipo = 'ALIGNED'
      impactoR$ = gap
      recomendacao = noitesParaVendaEfetiva > 0
        ? `Preço alinhado. Foco em volume — ${noitesParaVendaEfetiva} noites disponíveis para venda efetiva.`
        : `Calendário praticamente cheio. Avaliar preço de última hora ou bloqueios.`
      prioridade = status === 'D' || status === 'E' ? 2 : 3
    } else {
      continue
    }

    wins.push({
      tipo,
      propertyId: id,
      nome: item.propriedade.nomepropriedade,
      praca: item.propriedade.praca || '—',
      grupo_nome: item.propriedade.grupo_nome || '—',
      sub_grupo: item.propriedade.sub_grupo,
      recomendacao,
      precoAtual,
      precoSugerido: Number(precoSugerido.toFixed(2)),
      noitesRestantes: noitesParaVendaEfetiva,
      ocupacaoOTB: Number(ocupacaoOTB.toFixed(1)),
      gap: Number(gap.toFixed(2)),
      impactoR$: Number(impactoR$.toFixed(2)),
      prioridade,
      phs,
      status,
    })
  }

  return wins.sort((a, b) => {
    if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade
    return b.impactoR$ - a.impactoR$
  })
}

function calculateYoY(
  data: IntegratedData[],
  mes: string,
  baselineYear: number
): MonthlyReportPayload['yoy'] {
  const [, monthStr] = mes.split('-')
  const baselineMes = `${baselineYear}-${monthStr}`
  let mai2025Receita = 0
  let mai2026OTB = 0
  const porPracaMap = new Map<string, { mai2025: number; mai2026OTB: number }>()

  for (const item of data) {
    const praca = item.propriedade.praca || '—'
    if (!porPracaMap.has(praca)) porPracaMap.set(praca, { mai2025: 0, mai2026OTB: 0 })
    const entry = porPracaMap.get(praca)!

    for (const r of item.reservas) {
      if (r.checkindate?.startsWith(baselineMes)) {
        const v = Number(r.reservetotal) || 0
        mai2025Receita += v
        entry.mai2025 += v
      } else if (r.checkindate?.startsWith(mes)) {
        const v = Number(r.reservetotal) || 0
        mai2026OTB += v
        entry.mai2026OTB += v
      }
    }
  }

  const porPraca = Array.from(porPracaMap.entries())
    .map(([praca, v]) => ({
      praca,
      mai2025: v.mai2025,
      mai2026OTB: v.mai2026OTB,
      deltaPct: v.mai2025 > 0 ? ((v.mai2026OTB - v.mai2025) / v.mai2025) * 100 : 0,
    }))
    .sort((a, b) => b.mai2026OTB - a.mai2026OTB)

  return {
    mai2025Receita,
    mai2026OTB,
    deltaPct: mai2025Receita > 0 ? ((mai2026OTB - mai2025Receita) / mai2025Receita) * 100 : 0,
    porPraca,
  }
}

export async function getMonthlyReport(mes: string, viewContext: string): Promise<MonthlyReportPayload> {
  if (!isValidMes(mes)) {
    throw new Error(`Invalid month format: ${mes}. Expected YYYY-MM.`)
  }

  const data = await getIntegratedDataFromBigQuery(viewContext)
  const { daysInMonth, year } = getMonthBounds(mes)
  const today = new Date()
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const monthStart = new Date(Date.UTC(year, Number.parseInt(mes.split('-')[1], 10) - 1, 1))
  const monthEnd = new Date(Date.UTC(year, Number.parseInt(mes.split('-')[1], 10), 0))

  const monthHasStarted = todayUTC >= monthStart
  const daysElapsed = monthHasStarted
    ? Math.min(daysInMonth, Math.floor((todayUTC.getTime() - monthStart.getTime()) / 86_400_000) + 1)
    : 0
  const daysRemaining = daysInMonth - daysElapsed

  let metaMensal = 0
  let metaMovel = 0
  let otb = 0
  let totalReservas = 0
  let totalNoites = 0
  let totalAntecedencia = 0
  const statusDist = { A: 0, B: 0, C: 0, D: 0, E: 0 }

  const itensPropriedade: MonthlyReportPayload['itensPropriedade'] = []

  for (const item of data) {
    const { meta, metaMovel: mm } = getMetaForMonth(item, mes)
    const reservasMes = item.reservas.filter((r) => reservaInMonth(r, mes))
    const otbProp = reservasMes.reduce((s, r) => s + (Number(r.reservetotal) || 0), 0)
    const noitesProp = reservasMes.reduce((s, r) => s + (Number(r.nightcount) || 0), 0)
    const antecedenciaProp = reservasMes.reduce((s, r) => s + (Number(r.antecedencia_reserva) || 0), 0)
    const status = calculatePropertyStatus(otbProp, meta, mm)

    metaMensal += meta
    metaMovel += mm
    otb += otbProp
    totalReservas += reservasMes.length
    totalNoites += noitesProp
    totalAntecedencia += antecedenciaProp
    if (meta > 0 || otbProp > 0) statusDist[status]++

    const canalCount = new Map<string, number>()
    for (const r of reservasMes) {
      canalCount.set(r.partnername, (canalCount.get(r.partnername) || 0) + 1)
    }
    const canalMaior = Array.from(canalCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]

    itensPropriedade.push({
      propertyId: item.propriedade.idpropriedade,
      nome: item.propriedade.nomepropriedade,
      praca: item.propriedade.praca || '—',
      grupo_nome: item.propriedade.grupo_nome || '—',
      sub_grupo: item.propriedade.sub_grupo,
      canalMaior,
      meta,
      metaMovel: mm,
      otb: otbProp,
      pctMeta: meta > 0 ? (otbProp / meta) * 100 : 0,
      status,
      nReservas: reservasMes.length,
      noites: noitesProp,
      ticketMedio: reservasMes.length > 0 ? otbProp / reservasMes.length : 0,
      adr: noitesProp > 0 ? otbProp / noitesProp : 0,
      precoAtual: Number((item.propriedade as any).valor_tarifario) || 0,
    })
  }

  const matrix = buildOccupancyMatrix(data, mes)
  const noitesDisponiveisTotal = matrix.reduce((s, r) => s + r.noitesDisponiveis, 0)
  const noitesVendidasTotal = matrix.reduce((s, r) => s + r.noitesVendidas, 0)
  const ocupacaoOTB = data.length > 0 && daysInMonth > 0
    ? (noitesVendidasTotal / (data.length * daysInMonth)) * 100
    : 0

  const adrOTB = totalNoites > 0 ? otb / totalNoites : 0
  const ticketMedioOTB = totalReservas > 0 ? otb / totalReservas : 0
  const antecedenciaMedia = totalReservas > 0 ? totalAntecedencia / totalReservas : 0

  const filterOptions = {
    pracas: Array.from(new Set(data.map((d) => d.propriedade.praca).filter(Boolean))).sort() as string[],
    grupos: Array.from(new Set(data.map((d) => d.propriedade.grupo_nome).filter(Boolean))).sort() as string[],
    status: ['A', 'B', 'C', 'D', 'E'],
    canais: Array.from(
      new Set(
        data.flatMap((d) =>
          d.reservas.filter((r) => reservaInMonth(r, mes)).map((r) => r.partnername)
        ).filter(Boolean)
      )
    ).sort() as string[],
  }

  return {
    mes,
    asOf: todayUTC.toISOString().split('T')[0],
    daysInMonth,
    daysElapsed,
    daysRemaining,
    monthHasStarted,
    filterOptions,
    kpis: {
      metaMensal: Number(metaMensal.toFixed(2)),
      metaMovel: Number(metaMovel.toFixed(2)),
      otb: Number(otb.toFixed(2)),
      otbPct: metaMensal > 0 ? Number(((otb / metaMensal) * 100).toFixed(1)) : 0,
      adrOTB: Number(adrOTB.toFixed(2)),
      ocupacaoOTB: Number(ocupacaoOTB.toFixed(1)),
      ticketMedioOTB: Number(ticketMedioOTB.toFixed(2)),
      antecedenciaMedia: Number(antecedenciaMedia.toFixed(1)),
      totalReservasOTB: totalReservas,
      noitesVendidasOTB: noitesVendidasTotal,
      noitesDisponiveis: noitesDisponiveisTotal,
    },
    statusDistribution: statusDist,
    porPraca: aggregateByDimension(data, 'praca', mes),
    porGrupo: aggregateByDimension(data, 'grupo_nome', mes),
    porCanal: aggregateByCanal(data, mes),
    ocupacao: matrix,
    gaps: detectGaps(matrix),
    rankings: buildRankings(data, mes),
    quickWins: detectQuickWins(data, mes, matrix),
    yoy: calculateYoY(data, mes, year - 1),
    pickup: calculatePickup(data, mes, year - 1),
    itensPropriedade: itensPropriedade.sort((a, b) => b.otb - a.otb),
  }
}
