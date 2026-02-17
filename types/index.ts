// ============================================
// TIPOS BASEADOS NO SCHEMA DO BIGQUERY
// ============================================

// warehouse.propriedades_subgrupos (Dimensão Principal)
export interface WebhookPropriedade {
  idpropriedade: string // IdPropriedade
  nomepropriedade: string // nomePropriedade
  grupo_nome: string // grupo_nome
  praca: string // praca
  empreendimento_pousada: string // empreendimento_pousada (short stay, long stay, mixed)
  sub_grupo: string // sub_grupo
  // Campos adicionais do schema
  nome_externo?: string // nome_externo
  Status_Aparente?: string // Status_Aparente
  longitude?: number // longitude
  latitude?: number // latitude
  _i_maxguests?: number // _i_maxguests
  _i_rooms?: number // _i_rooms
  valor_tarifario?: number // valor_tarifario (base rate)
  valor_stays?: number // valor_stays (alternative base rate)
}

// warehouse.reservas_all (Fatos de Venda)
export interface WebhookReserva {
  idpropriedade: string // idPropriedade
  idReserva?: string // idReserva
  type?: string // type (confirmed, canceled, pending)
  companycommision: number // companyCommision
  buyprice: number // buyPrice
  reservetotal: number // reserveTotal
  checkoutdate: string // checkOutDate - ISO format YYYY-MM-DD
  creationdate: string // creationDate - ISO format YYYY-MM-DD
  checkindate: string // checkInDate - ISO format YYYY-MM-DD
  antecedencia_reserva: number // calculated: creationDate to checkinDate
  guesttotalcount: number // guestTotalCount
  nightcount: number // nightCount
  pricepernight: number // pricePerNight
  partnername: string // partnerName (canal de venda)
  agentname: string // agentName
}

// stage.metas_mensais_unidade (Metas)
export interface WebhookMeta {
  IdPropriedade: string // idPropriedade
  data_especifica: string // ISO format YYYY-MM-DD (primeiro dia do mês)
  meta: number // meta mensal
  meta_movel: number // meta móvel
  mes?: number // mês (1-12) - derivado de data_especifica
}

// Metas de Vendas (webhook separado)
export interface SalesGoals {
  IdPropriedade: string
  mcriacao_semanal: number // meta de criação semanal
  mvenda_mensal: number // meta de venda mensal
}

// stage.calendar_listing (Tarifário Atual)
export interface CalendarListing {
  id: string // chave da propriedade (idpropriedade)
  from: string // DATE - início da validade
  to: string // STRING - fim da validade (PARSE_DATE('%Y-%m-%d', to))
  baseratevalue: number // valor base da diária
  rateplans: string // JSON com regras tarifárias
}

// stage.ocupacaoDisponibilidade_teste1 (Calendário)
export interface OcupacaoDisponibilidade {
  idpropriedade: string
  datas: string // YYYY-MM-DD
  idreserva: string | null
  ocupado: number // 0 ou 1
  ocupado_proprietario: number // 0 ou 1
  manutencao: number // 0 ou 1
  disponivel: number // 0 ou 1
}

// stage.stay_reviews (Avaliações)
export interface StayReview {
  idPropriedade: string // ID do Anúncio
  Data: string // '31 jan 2025'
  ExternalChannelName: string // External Channel Name
  Avaliacao: number // 0 a 5
}

// stage.airbnb_extrações (Inteligência competitiva)
export interface AirbnbExtracao {
  data_extracao: string // 'DD-MM-YYYY'
  tipo_propriedade: string
  nome_anuncio: string
  preco_total: number
  media_avaliacao: string // 'N/A' ou numérico
  quantidade_noites: number
  hospedes_adultos: number
  latitude: number
  longitude: number
  preferido_hospedes: boolean
}

// Cotações (Supabase)
export interface Cotacao {
  id: string
  origem: string
  destino: string
  data_cotacao: string
  valor_estimado: number
  convertida: boolean
}

// Google Trends (Supabase)
export interface GoogleTrendsData {
  termo: string
  data: string
  indice: number // 0-100
  regiao: string
}

// ============================================
// TIPOS DERIVADOS E CALCULADOS
// ============================================

// Métricas calculadas por propriedade
export interface PropriedadeMetricas {
  totalReservas: number
  receitaTotal: number
  ticketMedio: number
  hospedesTotais: number
  diariasVendidas: number
  precoMedioNoite: number
  antecedenciaMedia: number
  metaMensal: number
  metaMovel: number
  receitaCheckoutMes: number // receita com checkout no mês atual
  status: "A" | "B" | "C" | "D" | "E"
}

// Dados integrados por propriedade
export interface IntegratedData {
  propriedade: WebhookPropriedade
  reservas: WebhookReserva[]
  metas: WebhookMeta[]
  salesGoals?: SalesGoals
  metricas: PropriedadeMetricas
  ocupacao: OcupacaoDisponibilidade[]
}

// Status de sincronização
export interface WebhookSyncStatus {
  lastSync: Date | null
  isLoading: boolean
  error: string | null
  totalPropriedades: number
  totalReservas: number
  totalMetas: number
}

// Configuração de webhooks
export interface WebhookConfig {
  webhook1Url: string // Propriedades
  webhook2Url: string // Reservas
  webhook3Url: string // Metas
  isConfigured: boolean
  timeout?: number
}

// Opções de filtro
export interface FilterOptions {
  praca?: string
  grupo_nome?: string
  sub_grupo?: string
  empreendimento_pousada?: string
  partnername?: string
  status?: string
}

// Date filter mode selector
export type DateFilterMode = 'checkin' | 'checkout' | 'saleDate'

// Filtros globais do dashboard (Extended)
export interface GlobalFilters {
  // Date Filters
  dateRange: { start: string; end: string } | null
  dateFilterMode: DateFilterMode // qual campo de data usar

  // Property Attributes (multi-select support)
  propertyIds: string[] // IDs específicos de propriedades
  pracas: string[] // multi-select de praças
  grupos: string[] // multi-select de grupos
  subGrupos: string[] // multi-select de sub-grupos
  tipoOperacao: string[] // 'short stay' | 'long stay' | 'mixed'

  // Booking Characteristics
  quartos: { min: number | null; max: number | null }
  hospedes: { min: number | null; max: number | null }

  // Channel & Status
  partnernames: string[] // multi-select (Airbnb, Booking, VRBO...)
  status: string[] // multi-select de status

  // Advanced Filters
  receita: { min: number | null; max: number | null }
  antecedenciaReserva: { min: number | null; max: number | null } // dias de antecedência
}

// Filter preset para quick access
export interface FilterPreset {
  id: string
  name: string
  filters: GlobalFilters
  isDefault?: boolean
  createdAt?: string
}

// Default empty filters
export const DEFAULT_FILTERS: GlobalFilters = {
  dateRange: null,
  dateFilterMode: 'checkin',
  propertyIds: [],
  pracas: [],
  grupos: [],
  subGrupos: [],
  tipoOperacao: [],
  quartos: { min: null, max: null },
  hospedes: { min: null, max: null },
  partnernames: [],
  status: [],
  receita: { min: null, max: null },
  antecedenciaReserva: { min: null, max: null },
}

export interface UnidadeMetrica extends WebhookPropriedade {
  realizado: number
  meta: number
  percentualAtingimento: number
}

// ============================================
// TIPOS LEGADOS (mantidos para compatibilidade)
// ============================================

export interface Propriedade {
  id: string
  nomepropriedade: string
  praca: string
  grupo: string
  partnername: string
  agentname: string
  status: string
}

export interface Reserva {
  id: string
  propriedadeId: string
  reservetotal: number
  creationdate: string
  checkin: string
  checkout: string
  hospedes: number
  diarias: number
  partnername: string
  agentname: string
  // Campos adicionais do schema
  idpropriedade?: string
  checkoutdate?: Date
  antecedencia_reserva?: number
}

export interface Meta {
  id: string
  propriedadeId: string
  metaMensal: number
  metaMovel: number
  mes: number
  ano: number
  // Campos adicionais
  idpropriedade?: string
  mes_ano?: string
  meta?: number
}

export interface HistoricoMensal {
  mes_ano: string
  realizado: number
  meta: number
  percentualAtingimento: number
}
