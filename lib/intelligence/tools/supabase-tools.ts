// ============================================
// SUPABASE TOOLS
// Competitor data, baskets, and Airbnb queries
// ============================================

import type { ToolDefinition, ToolResult } from '../types'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { executeQuery } from '@/lib/bigquery-client'

/**
 * Known praça center coordinates (fallback when property has no lat/lon)
 */
const PRACA_COORDS: Record<string, { lat: number; lon: number }> = {
  'porto de galinhas': { lat: -8.5066, lon: -35.0054 },
  'maragogi': { lat: -9.0122, lon: -35.2225 },
  'recife': { lat: -8.0476, lon: -34.8770 },
  'joao pessoa': { lat: -7.1195, lon: -34.8450 },
  'joão pessoa': { lat: -7.1195, lon: -34.8450 },
  'carneiros': { lat: -8.6942, lon: -35.0997 },
  'ipojuca': { lat: -8.3987, lon: -35.0588 },
  'pipa': { lat: -6.2280, lon: -35.0476 },
  'natal': { lat: -5.7945, lon: -35.2110 },
  'natal e litoral sul': { lat: -5.9080, lon: -35.1780 },
  'milagres': { lat: -9.3106, lon: -35.3806 },
  'japaratinga': { lat: -9.0870, lon: -35.2640 },
  'sao miguel do gostoso': { lat: -5.1180, lon: -35.6360 },
  'são miguel do gostoso': { lat: -5.1180, lon: -35.6360 },
  'bananeiras': { lat: -6.7500, lon: -35.6314 },
  'jacuma': { lat: -7.2930, lon: -34.8350 },
  'jacumã': { lat: -7.2930, lon: -34.8350 },
  'touros': { lat: -5.1992, lon: -35.4608 },
  'cabedelo': { lat: -6.9810, lon: -34.8340 },
}

/**
 * Geocode a location name using Google Places API (last resort)
 */
async function geocodeLocation(locationName: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
    if (!apiKey) return null

    const query = encodeURIComponent(`${locationName}, Brasil`)
    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}&language=pt-BR`
    )
    const data = await resp.json()
    if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
      const loc = data.results[0].geometry.location
      return { lat: Number(loc.lat), lon: Number(loc.lng) }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Lookup property coordinates with 3-layer fallback:
 * 1. BigQuery (property lat/lon)
 * 2. Known praça map (zero API cost)
 * 3. Google Geocoding API (last resort)
 */
async function lookupPropertyCoords(propertyId: string): Promise<{ lat: number; lon: number; source: string } | null> {
  try {
    const sanitized = propertyId.replace(/'/g, "''")

    // Layer 1: Direct lat/lon from BigQuery
    const rows = await executeQuery<{ latitude: number | null; longitude: number | null; praca: string | null }>(
      `SELECT latitude, longitude, praca FROM \`warehouse.propriedades_subgrupos\` WHERE idpropriedade = '${sanitized}' LIMIT 1`
    )

    if (rows.length > 0) {
      const row = rows[0]

      // Has direct coordinates
      if (row.latitude && row.longitude) {
        return { lat: Number(row.latitude), lon: Number(row.longitude), source: 'bigquery' }
      }

      // Layer 2: Fallback to praça known coords
      if (row.praca) {
        const pracaKey = row.praca.toLowerCase().trim()
        const known = PRACA_COORDS[pracaKey]
        if (known) {
          return { ...known, source: `praca_map:${row.praca}` }
        }

        // Layer 3: Google Geocoding API
        const geocoded = await geocodeLocation(row.praca)
        if (geocoded) {
          return { ...geocoded, source: `geocoding:${row.praca}` }
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Resolve coordinates from various inputs with fallback chain
 */
async function resolveCoordinates(params: Record<string, unknown>): Promise<{ lat: number; lon: number; source: string } | null> {
  // Direct lat/lon provided
  if (params.latitude && params.longitude) {
    return { lat: Number(params.latitude), lon: Number(params.longitude), source: 'direct' }
  }

  // By property_id
  if (params.property_id) {
    return lookupPropertyCoords(String(params.property_id))
  }

  // By praça name (useful when no property specified)
  if (params.praca) {
    const pracaKey = String(params.praca).toLowerCase().trim()
    const known = PRACA_COORDS[pracaKey]
    if (known) return { ...known, source: `praca_map:${params.praca}` }

    const geocoded = await geocodeLocation(String(params.praca))
    if (geocoded) return { ...geocoded, source: `geocoding:${params.praca}` }
  }

  return null
}

/**
 * Calculate median from a sorted number array
 */
function median(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export const supabaseTools: ToolDefinition[] = [
  // ── 1. GEOGRAPHIC COMPETITOR SEARCH ──────────────────
  {
    name: 'query_competitors',
    description:
      'Busca concorrentes do Airbnb por localizacao geografica (raio). Aceita: property_id (auto-busca coords), praca (nome da cidade/regiao), OU latitude/longitude direto. Suporta filtro de datas.',
    parameters: {
      property_id: {
        type: 'string',
        description: 'ID da propriedade interna (busca lat/lon automaticamente). Use este OU praca OU latitude/longitude.',
        required: false,
      },
      praca: {
        type: 'string',
        description: 'Nome da praca/cidade para buscar concorrentes (ex: "Porto de Galinhas", "Maragogi"). Resolve coordenadas automaticamente.',
        required: false,
      },
      latitude: {
        type: 'number',
        description: 'Latitude do ponto central de busca (opcional)',
        required: false,
      },
      longitude: {
        type: 'number',
        description: 'Longitude do ponto central de busca (opcional)',
        required: false,
      },
      radius_km: {
        type: 'number',
        description: 'Raio de busca em km (padrao 5)',
        required: false,
      },
      min_guests: {
        type: 'number',
        description: 'Numero minimo de hospedes (padrao 2)',
        required: false,
      },
      start_date: {
        type: 'string',
        description: 'Data inicio de checkin (formato YYYY-MM-DD). Filtra precos de datas futuras.',
        required: false,
      },
      end_date: {
        type: 'string',
        description: 'Data fim de checkin (formato YYYY-MM-DD). Filtra precos de datas futuras.',
        required: false,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['market', 'pricing'],
    execute: async (params): Promise<ToolResult> => {
      const supabase = getSupabaseAdmin()
      if (!supabase) {
        return { success: false, error: 'Supabase nao configurado', summary: 'Erro de conexao com Supabase.' }
      }

      try {
        // Resolve coordinates from property_id, praca, or direct lat/lon (3-layer fallback)
        const resolved = await resolveCoordinates(params)
        if (!resolved) {
          return {
            success: false,
            error: 'Nao foi possivel determinar coordenadas. Informe property_id, praca, ou latitude/longitude.',
            summary: 'Coordenadas nao resolvidas.',
          }
        }
        const { lat, lon, source } = resolved

        const { data, error } = await supabase.rpc('buscar_concorrentes_v3', {
          p_latitude: lat,
          p_longitude: lon,
          p_raio_km: Number(params.radius_km) || 5,
          p_hospedes: Number(params.min_guests) || 2,
          p_start_date: params.start_date ? String(params.start_date) : null,
          p_end_date: params.end_date ? String(params.end_date) : null,
        })

        if (error) {
          return { success: false, error: error.message, summary: `Erro na busca: ${error.message}` }
        }

        // Deduplicate: keep latest extraction per listing
        const byListing: Record<string, Record<string, unknown>> = {}
        for (const row of data || []) {
          const id = String(row.id_numerica || row.id)
          const existing = byListing[id]
          if (!existing || new Date(String(row.data_extracao)) > new Date(String(existing.data_extracao))) {
            const preco = row.preco_total && row.quantidade_noites
              ? Number(row.preco_total) / Number(row.quantidade_noites)
              : 0
            byListing[id] = { ...row, preco_por_noite: Math.round(preco * 100) / 100 }
          }
        }
        const results = Object.values(byListing).slice(0, 80)

        // Market stats
        const prices = results
          .map(r => Number(r.preco_por_noite || 0))
          .filter(p => p > 0)
          .sort((a, b) => a - b)
        const medianPrice = median(prices)
        const avgPrice = prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : 0

        return {
          success: true,
          data: results,
          summary: `${results.length} concorrentes unicos num raio de ${Number(params.radius_km) || 5}km (coords via ${source}). Mediana: R$ ${medianPrice.toFixed(2)}/noite. Media: R$ ${avgPrice.toFixed(2)}/noite.${params.start_date ? ` Periodo: ${params.start_date} a ${params.end_date || 'hoje'}.` : ''}`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
          summary: 'Falha ao buscar concorrentes.',
        }
      }
    },
  },

  // ── 2. LIST BASKETS ──────────────────────────────────
  {
    name: 'query_baskets',
    description:
      'Lista cestas de comparacao de mercado (baskets). Cada cesta agrupa propriedades internas e concorrentes Airbnb da mesma tipologia. Retorna itens internos e externos de cada cesta.',
    parameters: {
      property_id: {
        type: 'string',
        description: 'Filtrar cestas que contenham esta propriedade interna (opcional)',
        required: false,
      },
      location: {
        type: 'string',
        description: 'Filtrar por localizacao da cesta (ex: "Porto de Galinhas")',
        required: false,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['market', 'pricing', 'analyst'],
    execute: async (params): Promise<ToolResult> => {
      const supabase = getSupabaseAdmin()
      if (!supabase) {
        return { success: false, error: 'Supabase nao configurado', summary: 'Erro de conexao.' }
      }

      try {
        let query = supabase
          .from('competitor_baskets')
          .select('*, basket_items(*)')
          .order('created_at', { ascending: false })
          .limit(50)

        if (params.location) {
          query = query.ilike('location', `%${String(params.location)}%`)
        }

        const { data: baskets, error } = await query

        if (error) {
          return { success: false, error: error.message, summary: `Erro: ${error.message}` }
        }

        // If filtering by property_id, filter baskets that contain this property in their items
        let filteredBaskets = baskets || []
        if (params.property_id) {
          const propId = String(params.property_id)
          filteredBaskets = filteredBaskets.filter((b: Record<string, unknown>) => {
            const items = b.basket_items as Array<Record<string, unknown>> | undefined
            return items?.some(i => i.item_type === 'internal' && String(i.internal_property_id) === propId)
          })
        }

        // Enrich summary with counts
        const totalInternal = filteredBaskets.reduce((sum: number, b: Record<string, unknown>) => {
          const items = b.basket_items as Array<Record<string, unknown>> | undefined
          return sum + (items?.filter(i => i.item_type === 'internal').length || 0)
        }, 0)
        const totalExternal = filteredBaskets.reduce((sum: number, b: Record<string, unknown>) => {
          const items = b.basket_items as Array<Record<string, unknown>> | undefined
          return sum + (items?.filter(i => i.item_type === 'external').length || 0)
        }, 0)

        return {
          success: true,
          data: filteredBaskets,
          summary: `${filteredBaskets.length} cestas encontradas. Total: ${totalInternal} propriedades internas, ${totalExternal} concorrentes externos.`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
          summary: 'Falha ao buscar cestas.',
        }
      }
    },
  },

  // ── 3. BASKET PRICES (ENRICHED) ─────────────────────
  {
    name: 'query_basket_prices',
    description:
      'Busca precos dos concorrentes de uma cesta especifica. Cruza basket_items com airbnb_extrações para retornar precos reais por checkin. Essencial para comparar nosso preco com o mercado.',
    parameters: {
      basket_id: {
        type: 'string',
        description: 'ID da cesta (UUID)',
        required: true,
      },
      start_date: {
        type: 'string',
        description: 'Data inicio de checkin (YYYY-MM-DD). Padrao: hoje.',
        required: false,
      },
      end_date: {
        type: 'string',
        description: 'Data fim de checkin (YYYY-MM-DD). Padrao: 30 dias adiante.',
        required: false,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['market', 'pricing', 'analyst'],
    execute: async (params): Promise<ToolResult> => {
      const supabase = getSupabaseAdmin()
      if (!supabase) {
        return { success: false, error: 'Supabase nao configurado', summary: 'Erro de conexao.' }
      }

      try {
        // 1. Get basket items
        const { data: basket, error: basketError } = await supabase
          .from('competitor_baskets')
          .select('*, basket_items(*)')
          .eq('id', String(params.basket_id))
          .single()

        if (basketError || !basket) {
          return { success: false, error: basketError?.message || 'Cesta nao encontrada', summary: 'Cesta nao encontrada.' }
        }

        const items = (basket.basket_items || []) as Array<Record<string, unknown>>
        const externalItems = items.filter(i => i.item_type === 'external' && i.airbnb_listing_id)
        const internalItems = items.filter(i => i.item_type === 'internal' && i.internal_property_id)

        if (externalItems.length === 0) {
          return {
            success: true,
            data: { basket, internal_items: internalItems, external_prices: [] },
            summary: `Cesta "${basket.name}" tem ${internalItems.length} propriedade(s) interna(s) mas nenhum concorrente externo cadastrado.`,
          }
        }

        // 2. Get Airbnb IDs from external items
        const airbnbIds = externalItems.map(i => String(i.airbnb_listing_id))

        // 3. Query airbnb_extrações for these IDs with date filter
        const today = new Date().toISOString().split('T')[0]
        const defaultEnd = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
        const startDate = params.start_date ? String(params.start_date) : today
        const endDate = params.end_date ? String(params.end_date) : defaultEnd

        // Use .in() filter for exact ID matching
        const priceQuery = supabase
          .from('airbnb_extrações')
          .select('id_numerica, nome_anuncio, preco_total, quantidade_noites, checkin_formatado, data_extracao, hospedes_adultos, url_anuncio')
          .in('id_numerica', airbnbIds.map(id => Number(id)))
          .gte('checkin_formatado', startDate)
          .lte('checkin_formatado', endDate)
          .order('checkin_formatado', { ascending: true })
          .order('data_extracao', { ascending: false })
          .limit(500)

        const { data: priceData, error: priceError } = await priceQuery

        if (priceError) {
          return { success: false, error: priceError.message, summary: `Erro ao buscar precos: ${priceError.message}` }
        }

        const filteredPrices = priceData || []

        // Compute per-listing latest price and stats
        const byListing: Record<string, { name: string; prices: number[]; latest_price: number }> = {}
        for (const row of filteredPrices) {
          const id = String(row.id_numerica)
          const ppn = row.preco_total && row.quantidade_noites
            ? Number(row.preco_total) / Number(row.quantidade_noites)
            : 0
          if (ppn <= 0) continue
          if (!byListing[id]) {
            byListing[id] = { name: String(row.nome_anuncio || id), prices: [], latest_price: ppn }
          }
          byListing[id].prices.push(ppn)
        }

        const allPrices = Object.values(byListing).flatMap(l => l.prices).sort((a, b) => a - b)
        const medianPrice = median(allPrices)
        const avgPrice = allPrices.length > 0 ? allPrices.reduce((s, p) => s + p, 0) / allPrices.length : 0

        return {
          success: true,
          data: {
            basket_name: basket.name,
            basket_location: basket.location,
            guest_capacity: basket.guest_capacity,
            internal_items: internalItems.map(i => ({ property_id: i.internal_property_id, is_primary: i.is_primary })),
            external_listings: Object.entries(byListing).map(([id, info]) => ({
              airbnb_id: id,
              name: info.name,
              latest_price_per_night: Math.round(info.latest_price * 100) / 100,
              avg_price_per_night: Math.round((info.prices.reduce((s, p) => s + p, 0) / info.prices.length) * 100) / 100,
              data_points: info.prices.length,
            })),
            market_stats: {
              median_price: Math.round(medianPrice * 100) / 100,
              avg_price: Math.round(avgPrice * 100) / 100,
              total_data_points: allPrices.length,
              listings_with_data: Object.keys(byListing).length,
            },
          },
          summary: `Cesta "${basket.name}": ${internalItems.length} prop. internas, ${externalItems.length} concorrentes. ${Object.keys(byListing).length} com dados de preco. Mediana: R$ ${medianPrice.toFixed(2)}/noite. Media: R$ ${avgPrice.toFixed(2)}/noite. Periodo: ${startDate} a ${endDate}.`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
          summary: 'Falha ao buscar precos da cesta.',
        }
      }
    },
  },

  // ── 4. COMPETITOR PRICE HISTORY ─────────────────────
  {
    name: 'query_competitor_prices',
    description:
      'Busca historico de precos de concorrentes especificos do Airbnb na tabela airbnb_extrações. Use quando o usuario perguntar sobre precos de mercado, concorrentes, ou dados do Airbnb.',
    parameters: {
      airbnb_ids: {
        type: 'string',
        description: 'IDs dos anuncios Airbnb separados por virgula (ex: "123456789,987654321")',
        required: false,
      },
      listing_name: {
        type: 'string',
        description: 'Buscar por nome parcial do anuncio',
        required: false,
      },
      start_date: {
        type: 'string',
        description: 'Data inicio de checkin (YYYY-MM-DD)',
        required: false,
      },
      end_date: {
        type: 'string',
        description: 'Data fim de checkin (YYYY-MM-DD)',
        required: false,
      },
      min_guests: {
        type: 'number',
        description: 'Minimo de hospedes',
        required: false,
      },
      max_results: {
        type: 'number',
        description: 'Maximo de resultados (padrao 50, max 200)',
        required: false,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['market', 'pricing', 'analyst'],
    execute: async (params): Promise<ToolResult> => {
      const supabase = getSupabaseAdmin()
      if (!supabase) {
        return { success: false, error: 'Supabase nao configurado', summary: 'Erro de conexao.' }
      }

      try {
        if (!params.airbnb_ids && !params.listing_name) {
          return {
            success: false,
            error: 'Informe airbnb_ids ou listing_name para buscar.',
            summary: 'Parametro obrigatorio nao fornecido.',
          }
        }

        let query = supabase
          .from('airbnb_extrações')
          .select('id_numerica, nome_anuncio, preco_total, quantidade_noites, checkin_formatado, data_extracao, hospedes_adultos, media_avaliacao, url_anuncio, latitude, longitude')
          .order('checkin_formatado', { ascending: true })
          .order('data_extracao', { ascending: false })

        // Filter by listing name
        if (params.listing_name) {
          query = query.ilike('nome_anuncio', `%${String(params.listing_name)}%`)
        }

        // Filter by date range
        if (params.start_date) {
          query = query.gte('checkin_formatado', String(params.start_date))
        }
        if (params.end_date) {
          query = query.lte('checkin_formatado', String(params.end_date))
        }

        // Filter by guests
        if (params.min_guests) {
          query = query.gte('hospedes_adultos', Number(params.min_guests))
        }

        // Filter by specific IDs
        if (params.airbnb_ids) {
          const ids = String(params.airbnb_ids).split(',').map(id => Number(id.trim()))
          query = query.in('id_numerica', ids)
        }

        const limit = Math.min(Number(params.max_results) || 50, 200)
        const { data, error } = await query.limit(limit)

        if (error) {
          return { success: false, error: error.message, summary: `Erro: ${error.message}` }
        }

        const results = data || []

        // Compute price per night and aggregate stats
        const enriched = results.map((row: Record<string, unknown>) => {
          const ppn = row.preco_total && row.quantidade_noites
            ? Math.round((Number(row.preco_total) / Number(row.quantidade_noites)) * 100) / 100
            : null
          return { ...row, preco_por_noite: ppn } as Record<string, unknown>
        })

        const prices = enriched
          .map(r => Number(r.preco_por_noite || 0))
          .filter(p => p > 0)
          .sort((a, b) => a - b)

        const uniqueListings = new Set(enriched.map(r => String(r.id_numerica))).size

        return {
          success: true,
          data: enriched,
          summary: `${enriched.length} registros de ${uniqueListings} anuncio(s). Mediana: R$ ${median(prices).toFixed(2)}/noite. Min: R$ ${(prices[0] || 0).toFixed(2)}. Max: R$ ${(prices[prices.length - 1] || 0).toFixed(2)}.`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
          summary: 'Falha ao buscar precos de concorrentes.',
        }
      }
    },
  },

  // ── 5. SEARCH AIRBNB LISTINGS ───────────────────────
  {
    name: 'search_airbnb_listings',
    description:
      'Busca anuncios do Airbnb por nome, localizacao ou capacidade. Use para descobrir concorrentes ou explorar dados de mercado. Para precos detalhados, use query_competitor_prices.',
    parameters: {
      listing_name: {
        type: 'string',
        description: 'Parte do nome do anuncio para buscar',
        required: false,
      },
      min_guests: {
        type: 'number',
        description: 'Minimo de hospedes',
        required: false,
      },
      max_guests: {
        type: 'number',
        description: 'Maximo de hospedes',
        required: false,
      },
      max_results: {
        type: 'number',
        description: 'Maximo de resultados (padrao 30, max 100)',
        required: false,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['market', 'pricing'],
    execute: async (params): Promise<ToolResult> => {
      const supabase = getSupabaseAdmin()
      if (!supabase) {
        return { success: false, error: 'Supabase nao configurado', summary: 'Erro de conexao.' }
      }

      try {
        let query = supabase
          .from('airbnb_extrações')
          .select('id_numerica, nome_anuncio, preco_total, quantidade_noites, hospedes_adultos, data_extracao, media_avaliacao, latitude, longitude, url_anuncio, checkin_formatado')
          .order('data_extracao', { ascending: false })

        if (params.listing_name) {
          query = query.ilike('nome_anuncio', `%${String(params.listing_name)}%`)
        }
        if (params.min_guests) {
          query = query.gte('hospedes_adultos', Number(params.min_guests))
        }
        if (params.max_guests) {
          query = query.lte('hospedes_adultos', Number(params.max_guests))
        }

        const limit = Math.min(Number(params.max_results) || 30, 100)
        const { data, error } = await query.limit(limit)

        if (error) {
          return { success: false, error: error.message, summary: `Erro: ${error.message}` }
        }

        // Deduplicate by listing name, keep latest
        const seen = new Map<string, Record<string, unknown>>()
        for (const row of data || []) {
          const name = String(row.nome_anuncio || row.id_numerica)
          if (!seen.has(name)) {
            const ppn = row.preco_total && row.quantidade_noites
              ? Math.round((Number(row.preco_total) / Number(row.quantidade_noites)) * 100) / 100
              : null
            seen.set(name, { ...row, preco_por_noite: ppn })
          }
        }
        const results = Array.from(seen.values())

        return {
          success: true,
          data: results,
          summary: `${results.length} anuncios unicos encontrados.`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
          summary: 'Falha ao buscar anuncios.',
        }
      }
    },
  },
]
