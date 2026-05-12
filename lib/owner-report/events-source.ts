/**
 * Busca eventos relevantes pra praça/período usando Gemini com Google Search
 * grounding. Parseia a saída textual em itens estruturados — best-effort, com
 * fallback gracioso pra lista vazia se a IA falhar ou retornar formato ruim.
 */

import { GoogleGenerativeAI } from "@google/generative-ai"
import type { EventosSazonalidadeData } from "@/components/owner-report/slides/eventos-sazonalidade"

const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ""

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

function periodoToLabel(ini: string, fim: string): string {
  const [yi, mi] = ini.split("-").map(Number)
  const [yf, mf] = fim.split("-").map(Number)
  if (yi === yf && mi === mf) return `${MESES[mi - 1]} de ${yi}`
  return `${MESES[mi - 1]}/${yi} a ${MESES[mf - 1]}/${yf}`
}

export async function fetchEventos(
  praca: string,
  ini: string,
  fim: string
): Promise<EventosSazonalidadeData["eventos"]> {
  if (!KEY || !praca) return []

  try {
    const genAI = new GoogleGenerativeAI(KEY)
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      tools: [{ googleSearch: {} } as any],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    })

    const periodo = periodoToLabel(ini, fim)
    const prompt = `Liste os EVENTOS NOMEÁVEIS COM DATA CONFIRMADA em ${praca} durante ${periodo}.

CRITÉRIOS DE INCLUSÃO:
- Festivais nomeados (ex: "Festival de Verão", "Carnaval da Pipa")
- Feriados nacionais e locais com data fixa
- Shows, concertos, eventos esportivos com data marcada
- Datas comemorativas que historicamente atraem turistas

NÃO INCLUA:
- Generalidades sobre sazonalidade ("alta temporada", "baixa temporada", "pós-temporada")
- "Período de pico", "verão", "inverno" como entradas isoladas
- Qualquer item sem nome próprio ou data específica

Para cada evento retorne APENAS este formato (uma linha por evento, separados por |):
NOME | DATA | IMPACTO

Exemplos válidos:
Festival de Verão | 5 a 10 de fev | alto
Feriado de Tiradentes | 21 de abr | médio
Encontro de Carros Antigos | 15 de abr | baixo

Exemplos INVÁLIDOS (não retornar):
Alta temporada | jan-fev | alto
Pós-temporada | a partir de 22 de abr | baixo
Período de baixa demanda | maio | baixo

Não escreva mais nada além das linhas. Não enumere. Use apenas "alto", "médio" ou "baixo" para impacto. Se não houver eventos, retorne uma única linha "SEM_EVENTOS".`

    const result = await model.generateContent(prompt)
    const text = (result.response.text() || "").trim()
    if (text.includes("SEM_EVENTOS")) return []

    // Filtra entradas que são na verdade observações sobre sazonalidade,
    // não eventos com nome próprio.
    const SAZONALIDADE_RE =
      /\b(pós[- ]?temporada|p[oó]s temporada|alta\s+temporada|baixa\s+temporada|baixa\s+demanda|alta\s+demanda|per[ií]odo\s+de\s+(pico|baixa|alta)|temporada\s+(alta|baixa)|sazonalidade)\b/i
    // Eventos com data não confirmada: descartar (proprietário não quer especulação).
    const INCERTO_RE = /\b(a\s+confirmar|tba|tbd|tbc|a\s+definir|n[aã]o\s+confirmad[oa]|provis[óo]rio|estimad[oa])\b/i

    const events = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && line.includes("|"))
      .map((line) => {
        const [nome, data, impacto] = line.split("|").map((s) => s.trim())
        const imp = impacto?.toLowerCase()
        return {
          nome: nome || "Evento",
          data: data || "",
          impacto: (imp === "alto" || imp === "médio" || imp === "medio" || imp === "baixo"
            ? imp.replace("medio", "médio")
            : "médio") as "alto" | "médio" | "baixo",
        }
      })
      .filter((e) => !SAZONALIDADE_RE.test(e.nome))
      .filter((e) => !INCERTO_RE.test(e.data) && !INCERTO_RE.test(e.nome))
      .slice(0, 8)
    return events
  } catch (err) {
    console.warn("[events-source] falha:", err instanceof Error ? err.message : err)
    return []
  }
}
