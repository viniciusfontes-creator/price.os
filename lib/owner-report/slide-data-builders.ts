/**
 * Owner report — slide data builders.
 *
 * Cada função pura recebe IntegratedData de UMA propriedade + intervalo
 * [ini, fim] (ISO YYYY-MM-DD, fim inclusivo) e devolve o shape exato do slide.
 *
 * Premissa: a UI/route já filtrou IntegratedData por idpropriedade antes de
 * chamar essas funções. Não fazemos fetch aqui.
 */

import type { IntegratedData, WebhookReserva } from "@/types"
import type { ResumoExecutivoData } from "@/components/owner-report/slides/resumo-executivo"
import type { PerformanceMetaData } from "@/components/owner-report/slides/performance-meta"
import type { Evolucao12mData } from "@/components/owner-report/slides/evolucao-12m"
import type { CapaData } from "@/components/owner-report/slides/capa"
import type { CalendarioOcupacaoData } from "@/components/owner-report/slides/calendario-ocupacao"
import type { MixCanaisData } from "@/components/owner-report/slides/mix-canais"
import type { ConclusaoData } from "@/components/owner-report/slides/conclusao"
import type { AssinaturaData } from "@/components/owner-report/slides/assinatura"
import type { EventosSazonalidadeData } from "@/components/owner-report/slides/eventos-sazonalidade"
import type { TarifaMercadoData } from "@/components/owner-report/slides/tarifa-mercado"
import type { ComparativoMercadoData } from "@/components/owner-report/slides/comparativo-mercado"
import { fetchMercado } from "./market-source"
import { fetchEventos } from "./events-source"

const MES_NOMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export interface PeriodoRange {
  ini: string // YYYY-MM-DD inclusivo
  fim: string // YYYY-MM-DD inclusivo
}

function parseYmd(s: string): Date {
  return new Date(s + "T00:00:00Z")
}

function daysInRangeInclusive(ini: string, fim: string): number {
  const a = parseYmd(ini).getTime()
  const b = parseYmd(fim).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000) + 1)
}

/** Noites da reserva que caem dentro de [ini, fim] (fim inclusivo). */
export function nightsOverlap(r: WebhookReserva, ini: string, fim: string): number {
  if (!r.checkindate || !r.checkoutdate) return 0
  const ci = parseYmd(r.checkindate).getTime()
  const co = parseYmd(r.checkoutdate).getTime() // checkout não conta como noite
  const start = parseYmd(ini).getTime()
  const endExclusive = parseYmd(fim).getTime() + 86_400_000
  const overlapStart = Math.max(ci, start)
  const overlapEnd = Math.min(co, endExclusive)
  return Math.max(0, Math.round((overlapEnd - overlapStart) / 86_400_000))
}

/** Receita atribuída proporcionalmente às noites dentro do período. */
function receitaProporcional(r: WebhookReserva, ini: string, fim: string): number {
  const total = Number(r.reservetotal) || 0
  const noites = Number(r.nightcount) || 0
  if (noites <= 0) return 0
  const overlap = nightsOverlap(r, ini, fim)
  if (overlap <= 0) return 0
  return total * (overlap / noites)
}

export function formatPeriodoLabel(ini: string, fim: string): string {
  const a = parseYmd(ini)
  const b = parseYmd(fim)
  const sameMonth = a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()
  const isFullMonth =
    sameMonth &&
    a.getUTCDate() === 1 &&
    b.getUTCDate() === new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + 1, 0)).getUTCDate()
  if (isFullMonth) return `${MES_NOMES[a.getUTCMonth()]} / ${a.getUTCFullYear()}`
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`
  return `${fmt(a)} → ${fmt(b)}`
}

/**
 * Receita atribuída a UM dia específico (proporcional à diária da reserva).
 * Usada quando a métrica exige "ocorreu no período X" (overlap).
 */

/**
 * Receita reconhecida quando o CHECKOUT da reserva cai dentro de [ini, fim].
 * É a convenção da empresa pra status A/B/C/D/E — não usar overlap aqui.
 */
function receitaCheckoutPeriodo(item: IntegratedData, ini: string, fim: string): number {
  return item.reservas
    .filter(
      (r) =>
        r.type !== "canceled" &&
        typeof r.checkoutdate === "string" &&
        r.checkoutdate >= ini &&
        r.checkoutdate <= fim
    )
    .reduce((s, r) => s + (Number(r.reservetotal) || 0), 0)
}

function metasNoPeriodo(item: IntegratedData, ini: string, fim: string): {
  meta: number
  metaMovel: number
} {
  // Metas são mensais (data_especifica = primeiro dia do mês).
  // Somamos as metas dos meses cobertos por [ini, fim].
  const startKey = ini.slice(0, 7)
  const endKey = fim.slice(0, 7)
  const matching = (item.metas || []).filter((m) => {
    const key = String(m.data_especifica || "").slice(0, 7)
    return key >= startKey && key <= endKey
  })
  return {
    meta: matching.reduce((s, m) => s + (Number(m.meta) || 0), 0),
    metaMovel: matching.reduce((s, m) => s + (Number(m.meta_movel) || 0), 0),
  }
}

function statusFromPct(pct: number): "A" | "B" | "C" | "D" | "E" {
  if (pct >= 1) return "A"
  if (pct >= 0.8) return "B"
  if (pct >= 0.5) return "C"
  if (pct >= 0.001) return "D"
  return "E"
}

const MESES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

function monthRange(year: number, month: number): { ini: string; fim: string } {
  const m = String(month).padStart(2, "0")
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { ini: `${year}-${m}-01`, fim: `${year}-${m}-${String(last).padStart(2, "0")}` }
}

export function buildPerformanceMeta(
  item: IntegratedData,
  { ini, fim }: PeriodoRange
): PerformanceMetaData {
  // O slide passa a refletir o ANO CORRENTE inteiro (Jan-Dez), com YTD
  // calculado até o mês de `fim`.
  const ano = parseInt(fim.slice(0, 4), 10)
  const fimMonth = parseInt(fim.slice(5, 7), 10) // 1-12

  const meses = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const mesKey = `${ano}-${String(mes).padStart(2, "0")}`
    const monthIni = `${mesKey}-01`
    const lastDay = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
    const monthFim = `${mesKey}-${String(lastDay).padStart(2, "0")}`

    const realizado = receitaCheckoutPeriodo(item, monthIni, monthFim)
    const meta = (item.metas || [])
      .filter((m) => String(m.data_especifica || "").slice(0, 7) === mesKey)
      .reduce((s, m) => s + (Number(m.meta) || 0), 0)

    return {
      mes,
      label: MESES_SHORT[i],
      realizado,
      meta,
      pct: meta > 0 ? realizado / meta : 0,
      futuro: mes > fimMonth,
    }
  })

  // YTD considera apenas meses já encerrados (≤ fimMonth)
  const ytd = meses
    .filter((m) => !m.futuro)
    .reduce(
      (acc, m) => ({
        realizado: acc.realizado + m.realizado,
        meta: acc.meta + m.meta,
      }),
      { realizado: 0, meta: 0 }
    )

  const pctYtd = ytd.meta > 0 ? ytd.realizado / ytd.meta : 0

  return {
    ano,
    nomePropriedade: item.propriedade.nomepropriedade || "—",
    periodoLabel: formatPeriodoLabel(ini, fim),
    realizadoYtd: ytd.realizado,
    metaYtd: ytd.meta,
    pctYtd,
    status: ytd.meta > 0 ? statusFromPct(pctYtd) : "E",
    meses,
  }
}

export function buildCapa(item: IntegratedData, { ini, fim }: PeriodoRange): CapaData {
  const prop = item.propriedade
  return {
    nomePropriedade: prop.nomepropriedade || "—",
    praca: prop.praca || "",
    grupo: prop.grupo_nome || "",
    subGrupo: prop.sub_grupo || null,
    periodoLabel: formatPeriodoLabel(ini, fim),
  }
}

export function buildCalendarioOcupacao(
  item: IntegratedData,
  { ini, fim }: PeriodoRange
): CalendarioOcupacaoData {
  const start = parseYmd(ini)
  const end = parseYmd(fim)
  const days: CalendarioOcupacaoData["dias"] = []

  // Ocupação derivada de reservas (mesma fonte do resumo executivo), não da
  // stage ocupacaoDisponibilidade — esta última costuma estar vazia/incompleta
  // para várias propriedades, o que zerava o calendário indevidamente.
  const ocupadosPorReserva = new Set<string>()
  for (const r of item.reservas) {
    if (r.type === "canceled") continue
    if (!r.checkindate || !r.checkoutdate) continue
    const ci = parseYmd(r.checkindate)
    const co = parseYmd(r.checkoutdate) // checkout não conta como noite
    const cur = new Date(ci)
    while (cur.getTime() < co.getTime()) {
      ocupadosPorReserva.add(cur.toISOString().slice(0, 10))
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
  }

  // Bloqueio/manutenção continuam vindo de item.ocupacao (única fonte com
  // essa distinção). Se não houver registro, o dia cai como "vaga".
  const byDate = new Map<string, { ocupado_proprietario: number; manutencao: number }>()
  for (const o of item.ocupacao || []) {
    const key = String(o.datas).slice(0, 10)
    byDate.set(key, {
      ocupado_proprietario: Number(o.ocupado_proprietario || 0),
      manutencao: Number(o.manutencao || 0),
    })
  }

  let ocupadas = 0
  let bloqueadas = 0
  let vagas = 0

  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    const ymd = cursor.toISOString().slice(0, 10)
    let status: CalendarioOcupacaoData["dias"][number]["status"] = "vaga"
    if (ocupadosPorReserva.has(ymd)) {
      status = "ocupada"
    } else {
      const rec = byDate.get(ymd)
      if (rec?.ocupado_proprietario) status = "bloqueada"
      else if (rec?.manutencao) status = "manutencao"
    }
    if (status === "ocupada") ocupadas++
    else if (status === "bloqueada" || status === "manutencao") bloqueadas++
    else vagas++
    days.push({ date: ymd, status })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const total = days.length || 1
  return {
    nomePropriedade: item.propriedade.nomepropriedade || "—",
    periodoLabel: formatPeriodoLabel(ini, fim),
    dias: days,
    ocupadas,
    bloqueadas,
    vagas,
    ocupacaoPct: ocupadas / total,
  }
}

export function buildMixCanais(
  item: IntegratedData,
  { ini, fim }: PeriodoRange
): MixCanaisData {
  const reservas = item.reservas.filter(
    (r) => r.type !== "canceled" && nightsOverlap(r, ini, fim) > 0
  )
  const map = new Map<string, { receita: number; reservas: number; noites: number }>()
  for (const r of reservas) {
    const canal = (r.partnername && r.partnername.trim()) || "Outros"
    if (!map.has(canal)) map.set(canal, { receita: 0, reservas: 0, noites: 0 })
    const row = map.get(canal)!
    const overlap = nightsOverlap(r, ini, fim)
    const noites = Number(r.nightcount) || 0
    const total = Number(r.reservetotal) || 0
    row.receita += noites > 0 ? total * (overlap / noites) : 0
    row.reservas += 1
    row.noites += overlap
  }
  const totalReceita = Array.from(map.values()).reduce((s, v) => s + v.receita, 0)
  const canais = Array.from(map.entries())
    .map(([canal, v]) => ({
      canal,
      receita: v.receita,
      reservas: v.reservas,
      noites: v.noites,
      adr: v.noites > 0 ? v.receita / v.noites : 0,
      share: totalReceita > 0 ? v.receita / totalReceita : 0,
    }))
    .sort((a, b) => b.receita - a.receita)

  return {
    nomePropriedade: item.propriedade.nomepropriedade || "—",
    periodoLabel: formatPeriodoLabel(ini, fim),
    canais,
    totalReceita,
  }
}

export function buildConclusao(
  item: IntegratedData,
  range: PeriodoRange,
  resumo: ResumoExecutivoData
): ConclusaoData {
  return {
    nomePropriedade: item.propriedade.nomepropriedade || "—",
    periodoLabel: formatPeriodoLabel(range.ini, range.fim),
    paragrafos: [
      `No período de ${formatPeriodoLabel(range.ini, range.fim)}, a unidade registrou receita de R$ ${Math.round(resumo.kpis.receita).toLocaleString("pt-BR")} com ocupação de ${Math.round(resumo.kpis.ocupacaoPct * 100)}% — um indicador consolidado da performance comercial.`,
      `Os canais de venda continuam diversificados e o volume de reservas (${resumo.kpis.nReservas}) está alinhado ao perfil esperado para esse mês, com diária média de R$ ${Math.round(resumo.kpis.adr).toLocaleString("pt-BR")}.`,
    ],
    proximosPassos: [
      "Revisar a precificação dos próximos meses considerando a sazonalidade.",
      "Avaliar bloqueios de proprietário em períodos de alta demanda.",
      "Monitorar concorrentes e ajustar o posicionamento competitivo.",
    ],
  }
}

/** Constrói o map "preço praticado por dia" a partir das reservas (pricepernight). */
function praticadaPorDia(item: IntegratedData, ini: string, fim: string): Map<string, number> {
  const out = new Map<string, number>()
  const start = parseYmd(ini).getTime()
  const endExclusive = parseYmd(fim).getTime() + 86_400_000
  for (const r of item.reservas) {
    if (r.type === "canceled") continue
    if (!r.checkindate || !r.checkoutdate) continue
    const ppn = Number(r.pricepernight) || 0
    if (ppn <= 0) continue
    const ci = parseYmd(r.checkindate).getTime()
    const co = parseYmd(r.checkoutdate).getTime()
    const a = Math.max(ci, start)
    const b = Math.min(co, endExclusive)
    for (let t = a; t < b; t += 86_400_000) {
      const ymd = new Date(t).toISOString().slice(0, 10)
      out.set(ymd, ppn)
    }
  }
  return out
}

/** Constrói o map "baserate do tarifário por dia" usando as faixas do item.tarifario. */
function baseRatePorDia(item: IntegratedData, ini: string, fim: string): Map<string, number> {
  const out = new Map<string, number>()
  const faixas = item.tarifario || []
  const cursor = parseYmd(ini)
  const end = parseYmd(fim)
  while (cursor.getTime() <= end.getTime()) {
    const ymd = cursor.toISOString().slice(0, 10)
    const match = faixas.find((f) => String(f.from) <= ymd && ymd <= String(f.to))
    if (match) out.set(ymd, Number(match.baserate) || 0)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

export async function buildTarifaEMercado(
  item: IntegratedData,
  range: PeriodoRange
): Promise<{ tarifaMercado: TarifaMercadoData | null; comparativo: ComparativoMercadoData | null }> {
  const praticada = praticadaPorDia(item, range.ini, range.fim)
  const baseRate = baseRatePorDia(item, range.ini, range.fim)
  const mercado = await fetchMercado(
    item.propriedade.idpropriedade,
    range.ini,
    range.fim,
    praticada,
    baseRate
  )
  if (!mercado || !mercado.basket) return { tarifaMercado: null, comparativo: null }

  // ADR praticada no período: média das tarifas com reserva
  const valoresPraticada = Array.from(praticada.values()).filter((v) => v > 0)
  const adrUnidade =
    valoresPraticada.length > 0
      ? valoresPraticada.reduce((s, v) => s + v, 0) / valoresPraticada.length
      : null

  const diasOcupados = praticada.size
  const totalDias = daysInRangeInclusive(range.ini, range.fim)
  const ocupacaoUnidade = totalDias > 0 ? diasOcupados / totalDias : null

  return {
    tarifaMercado: {
      nomePropriedade: item.propriedade.nomepropriedade || "—",
      periodoLabel: formatPeriodoLabel(range.ini, range.fim),
      basketName: mercado.basket.basketName || "—",
      serie: mercado.serieDiaria,
    },
    comparativo: {
      nomePropriedade: item.propriedade.nomepropriedade || "—",
      periodoLabel: formatPeriodoLabel(range.ini, range.fim),
      basketName: mercado.basket.basketName || "—",
      adrUnidade,
      adrMedianaCesta: mercado.medianaMercadoPeriodo,
      adrP75Cesta: mercado.p75MercadoPeriodo,
      ocupacaoUnidade,
      ocupacaoEstimadaCesta: mercado.ocupacaoEstimadaMercado,
    },
  }
}

export async function buildEventos(
  item: IntegratedData,
  range: PeriodoRange
): Promise<EventosSazonalidadeData> {
  const eventos = await fetchEventos(item.propriedade.praca, range.ini, range.fim)
  return {
    nomePropriedade: item.propriedade.nomepropriedade || "—",
    periodoLabel: formatPeriodoLabel(range.ini, range.fim),
    praca: item.propriedade.praca || "",
    eventos,
  }
}

export function buildAssinatura(
  item: IntegratedData,
  range: PeriodoRange,
  createdByEmail: string
): AssinaturaData {
  return {
    nomePropriedade: item.propriedade.nomepropriedade || "—",
    periodoLabel: formatPeriodoLabel(range.ini, range.fim),
    autorEmail: createdByEmail,
    geradoEm: new Date().toISOString(),
  }
}

/**
 * Evolução 12 meses (rolling): receita mês a mês dos últimos 12 meses
 * encerrando em `fim`, com mesmo mês do ano anterior (YoY).
 */
export function buildEvolucao12m(
  item: IntegratedData,
  { fim }: PeriodoRange
): Evolucao12mData {
  const fimYear = parseInt(fim.slice(0, 4), 10)
  const fimMonth = parseInt(fim.slice(5, 7), 10)

  const meses = [] as Evolucao12mData["meses"]
  let total = 0
  let totalAnoAnt = 0

  for (let offset = 11; offset >= 0; offset--) {
    // calcula mês "fim - offset"
    const base = new Date(Date.UTC(fimYear, fimMonth - 1 - offset, 1))
    const y = base.getUTCFullYear()
    const m = base.getUTCMonth() + 1
    const { ini, fim: mFim } = monthRange(y, m)
    const realizado = receitaCheckoutPeriodo(item, ini, mFim)

    const prev = new Date(Date.UTC(y - 1, m - 1, 1))
    const py = prev.getUTCFullYear()
    const pm = prev.getUTCMonth() + 1
    const prevRange = monthRange(py, pm)
    const realizadoAnoAnt = receitaCheckoutPeriodo(item, prevRange.ini, prevRange.fim)

    meses.push({
      ano: y,
      mes: m,
      label: MESES_SHORT[m - 1],
      labelLong: `${MESES_SHORT[m - 1]}/${String(y).slice(2)}`,
      realizado,
      realizadoAnoAnt,
      yoyPct: realizadoAnoAnt > 0 ? (realizado - realizadoAnoAnt) / realizadoAnoAnt : null,
    })
    total += realizado
    totalAnoAnt += realizadoAnoAnt
  }

  return {
    nomePropriedade: item.propriedade.nomepropriedade || "—",
    periodoLabel: formatPeriodoLabel(fim.slice(0, 7) + "-01", fim),
    total12m: total,
    totalAnoAnterior: totalAnoAnt,
    deltaPct: totalAnoAnt > 0 ? (total - totalAnoAnt) / totalAnoAnt : null,
    meses,
  }
}

export function buildResumoExecutivo(
  item: IntegratedData,
  { ini, fim }: PeriodoRange
): ResumoExecutivoData {
  const rooms = Number((item.propriedade as any)._i_rooms) || 1
  const reservasNoPeriodo = item.reservas.filter(
    (r) => r.type !== "canceled" && nightsOverlap(r, ini, fim) > 0
  )

  const noitesVendidas = reservasNoPeriodo.reduce((s, r) => s + nightsOverlap(r, ini, fim), 0)
  const receita = reservasNoPeriodo.reduce((s, r) => s + receitaProporcional(r, ini, fim), 0)
  const totalHospedes = reservasNoPeriodo.reduce((s, r) => s + (Number(r.guesttotalcount) || 0), 0)
  const diariasDisponiveis = daysInRangeInclusive(ini, fim) * rooms
  const nReservas = reservasNoPeriodo.length

  return {
    nomePropriedade: item.propriedade.nomepropriedade || "—",
    periodoLabel: formatPeriodoLabel(ini, fim),
    kpis: {
      receita,
      nReservas,
      ocupacaoPct: diariasDisponiveis > 0 ? noitesVendidas / diariasDisponiveis : 0,
      adr: noitesVendidas > 0 ? receita / noitesVendidas : 0,
      mediaHospedes: nReservas > 0 ? totalHospedes / nReservas : 0,
    },
  }
}
