/**
 * Fonte de dados de mercado para slides Tarifa×Mercado e Comparativo Mercado.
 * Cruza a cesta de concorrentes da unidade (competitor_baskets / basket_items)
 * com extrações do Airbnb (airbnb_extrações) e calcula mediana por dia.
 *
 * Falha gracioso: se a unidade não tem cesta cadastrada, retorna null. O
 * renderer cai no slide placeholder explicando "configure a cesta no
 * Market Monitor".
 */

import { getSupabaseAdmin } from "@/lib/supabase-server"

export interface BasketSummary {
  basketId: string
  basketName: string
  externalAirbnbIds: number[]
}

export interface MercadoDiaPonto {
  date: string // YYYY-MM-DD
  praticada: number | null // tarifa real da unidade no dia (pode ser null se sem reserva nesse dia)
  baseTarifario: number | null // baserate do tarifário da unidade
  medianaMercado: number | null // mediana da cesta nesse dia
}

export interface MercadoAgregado {
  basket: BasketSummary | null
  serieDiaria: MercadoDiaPonto[]
  medianaMercadoPeriodo: number | null
  p75MercadoPeriodo: number | null
  ocupacaoEstimadaMercado: number | null // % dias com extração > 0 / dias do período
}

/** Encontra a primeira basket que tem a unidade como internal_property_id. */
async function findBasketForUnit(idpropriedade: string): Promise<BasketSummary | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null

  const { data: linkage, error } = await sb
    .from("basket_items")
    .select("basket_id")
    .eq("item_type", "internal")
    .eq("internal_property_id", idpropriedade)
    .limit(1)
    .maybeSingle()
  if (error || !linkage) return null

  const basketId = (linkage as any).basket_id as string
  const { data: basket } = await sb
    .from("competitor_baskets")
    .select("id, name, basket_items(item_type, airbnb_listing_id)")
    .eq("id", basketId)
    .maybeSingle()
  if (!basket) return null

  const items = ((basket as any).basket_items || []) as Array<{
    item_type: string
    airbnb_listing_id: string | number | null
  }>
  const externalIds = items
    .filter((i) => i.item_type === "external" && i.airbnb_listing_id != null)
    .map((i) => Number(i.airbnb_listing_id))
    .filter((n) => Number.isFinite(n))

  return {
    basketId: (basket as any).id,
    basketName: (basket as any).name || "",
    externalAirbnbIds: externalIds,
  }
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function percentile(nums: number[], p: number): number | null {
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))
  return sorted[idx]
}

function* daysInRange(ini: string, fim: string): Generator<string> {
  const start = new Date(ini + "T00:00:00Z")
  const end = new Date(fim + "T00:00:00Z")
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    yield cursor.toISOString().slice(0, 10)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
}

export async function fetchMercado(
  idpropriedade: string,
  ini: string,
  fim: string,
  praticadaPorDia: Map<string, number>, // construída pelo caller a partir de item.reservas
  baseRatePorDia: Map<string, number>
): Promise<MercadoAgregado | null> {
  const basket = await findBasketForUnit(idpropriedade)
  if (!basket || basket.externalAirbnbIds.length === 0) return null

  const sb = getSupabaseAdmin()!
  const { data: rows, error } = await sb
    .from("airbnb_extrações")
    .select("id_numerica, preco_total, quantidade_noites, checkin_formatado")
    .in("id_numerica", basket.externalAirbnbIds)
    .gte("checkin_formatado", ini)
    .lte("checkin_formatado", fim)
    .limit(5000)
  if (error || !rows) {
    return {
      basket,
      serieDiaria: [],
      medianaMercadoPeriodo: null,
      p75MercadoPeriodo: null,
      ocupacaoEstimadaMercado: null,
    }
  }

  // Agrupa preços por dia (pricePerNight)
  const porDia = new Map<string, number[]>()
  for (const r of rows as any[]) {
    const date = String(r.checkin_formatado || "").slice(0, 10)
    const total = Number(r.preco_total) || 0
    const noites = Number(r.quantidade_noites) || 0
    if (!date || noites <= 0 || total <= 0) continue
    const ppn = total / noites
    if (!porDia.has(date)) porDia.set(date, [])
    porDia.get(date)!.push(ppn)
  }

  const todasMedianas: number[] = []
  const serieDiaria: MercadoDiaPonto[] = []
  let diasComExtracao = 0
  let diasTotal = 0
  for (const date of daysInRange(ini, fim)) {
    diasTotal++
    const arr = porDia.get(date) || []
    const med = median(arr)
    if (med != null) {
      diasComExtracao++
      todasMedianas.push(med)
    }
    serieDiaria.push({
      date,
      praticada: praticadaPorDia.get(date) ?? null,
      baseTarifario: baseRatePorDia.get(date) ?? null,
      medianaMercado: med,
    })
  }

  return {
    basket,
    serieDiaria,
    medianaMercadoPeriodo: median(todasMedianas),
    p75MercadoPeriodo: percentile(todasMedianas, 0.75),
    ocupacaoEstimadaMercado: diasTotal > 0 ? diasComExtracao / diasTotal : null,
  }
}
