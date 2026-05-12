/**
 * Templates de relatório — define a sequência inicial de slides quando
 * um rascunho é criado. Cada slide pode ser escondido (visible=false) ou
 * ter seus textos sobrescritos pelo estagiário no editor.
 */

export type SlideKey =
  | "capa"
  | "resumo_executivo"
  | "performance_meta"
  | "evolucao_12m"
  | "calendario_ocupacao"
  | "mix_canais"
  | "tarifa_mercado"
  | "comparativo_mercado"
  | "eventos_sazonalidade"
  | "conclusao_proximos_passos"
  | "assinatura"

export interface SlideConfig {
  key: SlideKey
  visible: boolean
  overrides: Record<string, string>
}

export const SLIDE_LABELS: Record<SlideKey, string> = {
  capa: "Capa",
  resumo_executivo: "Resumo Executivo",
  performance_meta: "Performance vs. Meta",
  evolucao_12m: "Evolução 12 meses",
  calendario_ocupacao: "Calendário de Ocupação",
  mix_canais: "Mix de Canais",
  tarifa_mercado: "Tarifa × Mercado",
  comparativo_mercado: "Comparativo de Mercado",
  eventos_sazonalidade: "Eventos & Sazonalidade",
  conclusao_proximos_passos: "Conclusão & Próximos Passos",
  assinatura: "Assinatura",
}

const MENSAL_V1: SlideConfig[] = [
  { key: "capa", visible: true, overrides: {} },
  { key: "resumo_executivo", visible: true, overrides: {} },
  { key: "performance_meta", visible: true, overrides: {} },
  { key: "evolucao_12m", visible: true, overrides: {} },
  { key: "calendario_ocupacao", visible: true, overrides: {} },
  { key: "mix_canais", visible: true, overrides: {} },
  // Os três slides abaixo dependem de cesta de concorrentes/eventos externos:
  // começam ocultos e o estagiário liga manualmente quando os dados existirem.
  { key: "tarifa_mercado", visible: false, overrides: {} },
  { key: "comparativo_mercado", visible: false, overrides: {} },
  { key: "eventos_sazonalidade", visible: false, overrides: {} },
  { key: "conclusao_proximos_passos", visible: true, overrides: {} },
  { key: "assinatura", visible: true, overrides: {} },
]

export function getTemplateSlides(templateKey: string): SlideConfig[] {
  switch (templateKey) {
    case "mensal_v1":
    default:
      return MENSAL_V1.map((s) => ({ ...s, overrides: { ...s.overrides } }))
  }
}
