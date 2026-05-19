export type PricingConfianca = "alta" | "media" | "baixa"
export type PricingStatus = "pendente" | "aprovado" | "rejeitado" | "aplicado" | "falhou"
export type StaysSyncStatus = "synced" | "dry_run" | "unmapped" | "error"
export type PricingSaude =
  | "barato"
  | "barato_recuperavel"
  | "caro"
  | "caro_validado"
  | "ok"
  | "sem_dados"
export type PricingPeriodoTipo = "month" | "event"

export interface PricingAjusteProposto {
  id: number
  idpropriedade: string
  nomepropriedade: string | null
  praca: string | null
  grupo_nome: string | null

  period_id: string | null
  periodo_nome: string
  periodo_tipo: PricingPeriodoTipo
  periodo_inicio: string
  periodo_fim: string

  baserate_atual: number | null
  baserate_sugerido: number
  delta_pct: number

  optimal_price: number | null
  meta_mensal: number | null
  share_pct: number | null
  expected_nights: number | null

  peer_median_price: number | null
  peer_count: number | null

  diaria_anterior: number | null
  reservas_anterior: number | null
  preco_validado: boolean | null
  fora_do_peer: boolean | null

  saude: PricingSaude | null
  confianca: PricingConfianca | null
  cenario: string | null
  justificativa: string | null

  status: PricingStatus
  aprovado_por: string | null
  aprovado_em: string | null
  comentario_revisor: string | null
  baserate_aplicado: number | null
  applied_at: string | null
  apply_error: string | null

  stays_sync_status: StaysSyncStatus | null
  stays_synced_at: string | null
  stays_sync_errors: unknown | null

  created_at: string
}
