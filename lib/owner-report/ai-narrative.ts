/**
 * Gera narrativa da Conclusão usando Gemini sobre o snapshot do relatório.
 * Falha silenciosa: se Gemini não responder, devolve null e o builder cai
 * no texto template default.
 */

import { GoogleGenerativeAI } from "@google/generative-ai"
import type { ResumoExecutivoData } from "@/components/owner-report/slides/resumo-executivo"
import type { PerformanceMetaData } from "@/components/owner-report/slides/performance-meta"
import type { Evolucao12mData } from "@/components/owner-report/slides/evolucao-12m"
import type { MixCanaisData } from "@/components/owner-report/slides/mix-canais"
import type { ConclusaoData } from "@/components/owner-report/slides/conclusao"

const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ""

interface NarrativeInput {
  nomePropriedade: string
  periodoLabel: string
  resumo: ResumoExecutivoData
  performance?: PerformanceMetaData
  evolucao?: Evolucao12mData
  mix?: MixCanaisData
}

export async function generateConclusaoNarrative(
  input: NarrativeInput
): Promise<Pick<ConclusaoData, "paragrafos" | "proximosPassos"> | null> {
  if (!KEY) return null
  try {
    const genAI = new GoogleGenerativeAI(KEY)
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024, responseMimeType: "application/json" },
    })

    const prompt = `Você é um analista de revenue management da Quarto à Vista, agência de gestão de aluguel por temporada. Escreva a CONCLUSÃO de um relatório enviado ao proprietário da unidade "${input.nomePropriedade}" referente a ${input.periodoLabel}.

Tom: institucional, claro, sem jargões técnicos, sem cifrões duplicados. Trate o proprietário com respeito mas sem formalidade exagerada.

DADOS DO PERÍODO:
- Receita: R$ ${Math.round(input.resumo.kpis.receita).toLocaleString("pt-BR")}
- Ocupação: ${Math.round(input.resumo.kpis.ocupacaoPct * 100)}%
- ADR (diária média): R$ ${Math.round(input.resumo.kpis.adr).toLocaleString("pt-BR")}
- Reservas: ${input.resumo.kpis.nReservas}
- Média de hóspedes/reserva: ${input.resumo.kpis.mediaHospedes.toFixed(1)}
${input.performance ? `\nPERFORMANCE ANUAL (até o período):
- Realizado YTD: R$ ${Math.round(input.performance.realizadoYtd).toLocaleString("pt-BR")} de R$ ${Math.round(input.performance.metaYtd).toLocaleString("pt-BR")} em metas (${Math.round(input.performance.pctYtd * 100)}%)
- Status: ${input.performance.status}` : ""}
${input.evolucao ? `\nEVOLUÇÃO YoY:
- Receita 12m: R$ ${Math.round(input.evolucao.total12m).toLocaleString("pt-BR")}
- 12m anteriores: R$ ${Math.round(input.evolucao.totalAnoAnterior).toLocaleString("pt-BR")}
- Variação: ${input.evolucao.deltaPct != null ? (input.evolucao.deltaPct * 100).toFixed(1) + "%" : "n/d"}` : ""}
${input.mix && input.mix.canais.length ? `\nMIX DE CANAIS (top 3):
${input.mix.canais.slice(0, 3).map((c) => `- ${c.canal}: ${Math.round(c.share * 100)}% da receita (${c.reservas} reservas)`).join("\n")}` : ""}

Retorne APENAS um JSON no formato exato:
{
  "paragrafos": [
    "primeiro parágrafo (≤ 3 frases) — começa explicando o desempenho do período",
    "segundo parágrafo (≤ 3 frases) — explica fatores e contexto (canais, sazonalidade, comparativo anual)"
  ],
  "proximosPassos": [
    "ação 1 — começa com verbo no infinitivo",
    "ação 2 — começa com verbo no infinitivo",
    "ação 3 — começa com verbo no infinitivo"
  ]
}`

    const res = await model.generateContent(prompt)
    const text = res.response.text()
    const parsed = JSON.parse(text)
    if (
      !parsed ||
      !Array.isArray(parsed.paragrafos) ||
      parsed.paragrafos.length === 0 ||
      !Array.isArray(parsed.proximosPassos) ||
      parsed.proximosPassos.length === 0
    ) {
      return null
    }
    return {
      paragrafos: parsed.paragrafos.map(String).slice(0, 3),
      proximosPassos: parsed.proximosPassos.map(String).slice(0, 5),
    }
  } catch (err) {
    console.warn("[ai-narrative] falhou, usando texto default:", err instanceof Error ? err.message : err)
    return null
  }
}
