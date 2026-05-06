export type Confianca = "alta" | "media" | "baixa"
export type StatusProposta = "pendente" | "aprovado" | "rejeitado" | "aplicado" | "falhou"
export type Cenario = "ALL_UP" | "ALL_DOWN" | "AB_ALIGNED" | "ONLY_A" | "ONLY_B" | "ONLY_C" | "CONFLICT"

export interface MetaAjusteProposto {
  id: number
  idpropriedade: string
  nomepropriedade: string | null
  praca: string | null
  grupo_nome: string | null
  mes_ano: string
  meta_atual: number
  meta_sugerida: number
  delta_pct: number
  sinal_meta_movel: number | null
  sinal_ano_passado: number | null
  sinal_similares: number | null
  meta_movel_alvo: number | null
  otb_alvo: number | null
  confianca: Confianca | null
  cenario: Cenario | null
  justificativa: string | null
  status: StatusProposta
  aprovado_por: string | null
  aprovado_em: string | null
  comentario_revisor: string | null
  meta_aplicada: number | null
  applied_at: string | null
  apply_error: string | null
  created_at: string
}
