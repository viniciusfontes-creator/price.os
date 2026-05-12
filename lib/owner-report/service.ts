/**
 * Owner Report Service
 *
 * Carrega IntegratedData do BigQuery (cache 5min reusada da camada existente),
 * filtra por idpropriedade e devolve os dados de cada slide pra um período.
 */

import { getIntegratedDataFromBigQuery } from "@/lib/bigquery-service"
import { serverCache } from "@/lib/server-cache"
import type { IntegratedData } from "@/types"
import {
  buildResumoExecutivo,
  buildPerformanceMeta,
  buildEvolucao12m,
  buildCapa,
  buildCalendarioOcupacao,
  buildMixCanais,
  buildConclusao,
  buildAssinatura,
  buildTarifaEMercado,
  buildEventos,
  type PeriodoRange,
} from "./slide-data-builders"
import type { ResumoExecutivoData } from "@/components/owner-report/slides/resumo-executivo"
import type { PerformanceMetaData } from "@/components/owner-report/slides/performance-meta"
import type { Evolucao12mData } from "@/components/owner-report/slides/evolucao-12m"
import {
  createOwnerReport,
  type OwnerReportRow,
  type CreateOwnerReportInput,
} from "./repository"
import { getTemplateSlides } from "./templates"
import { generateConclusaoNarrative } from "./ai-narrative"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isValidPeriod(p: PeriodoRange): boolean {
  return ISO_DATE.test(p.ini) && ISO_DATE.test(p.fim) && p.ini <= p.fim
}

async function loadIntegrated(viewContext: string): Promise<IntegratedData[]> {
  return serverCache.getOrFetch(
    `integrated_${viewContext}`,
    () => getIntegratedDataFromBigQuery(viewContext),
    300
  )
}

export async function findPropertyData(
  idpropriedade: string,
  viewContext = "overview"
): Promise<IntegratedData | null> {
  const all = await loadIntegrated(viewContext)
  return all.find((it) => it.propriedade.idpropriedade === idpropriedade) || null
}

export interface OwnerReportPayload {
  idpropriedade: string
  periodo: PeriodoRange
  resumoExecutivo: ResumoExecutivoData
}

export async function buildOwnerReportPayload(
  idpropriedade: string,
  periodo: PeriodoRange,
  viewContext = "overview"
): Promise<OwnerReportPayload | { error: string }> {
  if (!isValidPeriod(periodo)) {
    return { error: `Período inválido (ini=${periodo.ini}, fim=${periodo.fim})` }
  }
  const item = await findPropertyData(idpropriedade, viewContext)
  if (!item) return { error: `Propriedade não encontrada: ${idpropriedade}` }

  return {
    idpropriedade,
    periodo,
    resumoExecutivo: buildResumoExecutivo(item, periodo),
  }
}

/**
 * Cria um rascunho de relatório: carrega BQ, monta snapshot imutável dos
 * slides disponíveis hoje e persiste no Supabase com a lista de slides do
 * template selecionado. Snapshot congela os números no momento da criação.
 */
export async function createDraftReport(args: {
  createdByEmail: string
  idpropriedade: string
  periodo: PeriodoRange
  templateKey?: string
  viewContext?: string
}): Promise<{ ok: true; report: OwnerReportRow } | { ok: false; error: string }> {
  const { createdByEmail, idpropriedade, periodo, templateKey = "mensal_v1" } = args

  if (!isValidPeriod(periodo)) {
    return { ok: false, error: `Período inválido (ini=${periodo.ini}, fim=${periodo.fim})` }
  }

  const item = await findPropertyData(idpropriedade, args.viewContext)
  if (!item) return { ok: false, error: `Propriedade não encontrada: ${idpropriedade}` }

  // Snapshot dos slides disponíveis (por enquanto: apenas resumo executivo).
  // Outros slides serão adicionados aqui conforme builders forem criados.
  const resumoExecutivo = buildResumoExecutivo(item, periodo)
  const performanceMeta = buildPerformanceMeta(item, periodo)
  const evolucao12m = buildEvolucao12m(item, periodo)
  const mixCanais = buildMixCanais(item, periodo)
  const conclusaoDefault = buildConclusao(item, periodo, resumoExecutivo)

  // Slides dependentes de dados externos rodam em paralelo. Os 3 podem falhar
  // (sem basket, sem internet) — falham gracioso.
  const [mercado, eventos] = await Promise.all([
    buildTarifaEMercado(item, periodo).catch(() => ({ tarifaMercado: null, comparativo: null })),
    buildEventos(item, periodo).catch(() => null),
  ])

  // IA gera os parágrafos da conclusão. Falha silenciosa: cai pro template default.
  const aiNarrative = await generateConclusaoNarrative({
    nomePropriedade: conclusaoDefault.nomePropriedade,
    periodoLabel: conclusaoDefault.periodoLabel,
    resumo: resumoExecutivo,
    performance: performanceMeta,
    evolucao: evolucao12m,
    mix: mixCanais,
  })

  const snapshot = {
    capa: buildCapa(item, periodo),
    resumoExecutivo,
    performanceMeta,
    evolucao12m,
    calendarioOcupacao: buildCalendarioOcupacao(item, periodo),
    mixCanais,
    tarifaMercado: mercado.tarifaMercado,
    comparativoMercado: mercado.comparativo,
    eventosSazonalidade: eventos,
    conclusao: aiNarrative
      ? { ...conclusaoDefault, ...aiNarrative, aiGenerated: true }
      : conclusaoDefault,
    assinatura: buildAssinatura(item, periodo, createdByEmail),
  }

  // Slides dependentes começam ocultos no template. Quando os dados existem
  // no snapshot, viramos visible:true automaticamente — assim o estagiário
  // não precisa lembrar de ligar manualmente quando há dados disponíveis.
  const slides = getTemplateSlides(templateKey).map((s) => {
    if (s.key === "tarifa_mercado" && mercado.tarifaMercado) return { ...s, visible: true }
    if (s.key === "comparativo_mercado" && mercado.comparativo) return { ...s, visible: true }
    if (s.key === "eventos_sazonalidade" && eventos && eventos.eventos.length > 0) {
      return { ...s, visible: true }
    }
    return s
  })

  const payload: CreateOwnerReportInput = {
    created_by_email: createdByEmail,
    idpropriedade,
    nome_propriedade: item.propriedade.nomepropriedade,
    periodo_inicio: periodo.ini,
    periodo_fim: periodo.fim,
    template_key: templateKey,
    slides,
    snapshot_data: snapshot,
  }

  const report = await createOwnerReport(payload)
  return { ok: true, report }
}
