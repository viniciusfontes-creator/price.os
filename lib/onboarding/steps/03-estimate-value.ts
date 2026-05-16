/**
 * Step 3: Estima propertyValue + propertyAppreciation com Gemini Flash Lite.
 *
 * Prompt + parâmetros idênticos ao node "Message a model" do workflow n8n
 * [Onboarding] Precificação e Estudo de Rentabilidade.
 */

import { GoogleGenerativeAI } from "@google/generative-ai"
import type { PipelineContext, SimilarProperty, ValueEstimate } from "../types"

const SYSTEM_INSTRUCTION = `Você é uma calculadora de Investimentos Imobiliários de alta precisão especializado em indicadores de aluguel por temporada no Brasil.

## MISSÃO
Sintetizar os dados reais da nossa base histórica para gerar uma análise de rentabilidade para um NOVO imóvel alvo.

## DADOS REAIS DE MERCADO (RETORNO DO SUPABASE)
- Atenção: Os imóveis abaixo foram extraídos via busca geolocalizada e representam o mercado real num raio de 5km do imóvel alvo. Considere estes dados como a única verdade para padrões de sazonalidade e precificação da região.

## PRINCÍPIOS DE ANÁLISE (OBRIGATÓRIOS)

1. PESO POR SIMILARIDADE: Dê maior peso aos imóveis da lista que possuem a mesma quantidade de quartos e área mais próxima (m²) do imóvel alvo. Imóveis com discrepância de área superior a 50% (como o de 700m²) devem ser usados apenas para entender a curva de sazonalidade da região, e não para definir o valor de venda (propertyValue).

## TAREFA DE CÁLCULO
- Baseie o 'propertyValue' na média ponderada dos valores encontrados, sempre dê um decréscimo de 10 a 20% do valor do imóvel.
- Baseie o 'propertyAppreciation' na média da vizinhança.

## FORMATO DE SAÍDA (ESTRITAMENTE JSON)
Retorne APENAS o JSON, sem explicações ou markdown:
{ "propertyValue": 850000, "propertyAppreciation": 0.08 }`

export async function estimateValue(ctx: PipelineContext): Promise<PipelineContext> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY env var is required for estimate-value step")
    }

    const similar: SimilarProperty[] = ctx.similar || []

    const lat = ctx.payload.latitude ?? ctx.bq?.latitude
    const lng = ctx.payload.longitude ?? ctx.bq?.longitude
    const quartos = ctx.payload.quartos ?? ctx.bq?._i_rooms ?? ctx.bq?._i_maxguests
    const titulo = ctx.payload.rotulo || ctx.payload.propriedade || ctx.bq?.nomepropriedade || ""

    const userMessage = `## IMÓVEL ALVO (INPUT DO USUÁRIO)
- Localização: ${titulo}
- Latitude: ${lat}
- Longitude: ${lng}
- Quartos: ${quartos}

## IMÓVEIS PRÓXIMOS ENCONTRADOS (raio 5km)
${JSON.stringify(similar, null, 2)}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
        model: "gemini-flash-lite-latest",
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
        },
    })

    const result = await model.generateContent(userMessage)
    const text = result.response.text()
    const estimate = parseEstimate(text)

    return { ...ctx, estimate }
}

function parseEstimate(text: string): ValueEstimate {
    try {
        // remove eventual cerca markdown
        const clean = text.replace(/```json\s*|\s*```/g, "").trim()
        const obj = JSON.parse(clean) as Partial<ValueEstimate>
        const pv = Number(obj.propertyValue)
        const pa = Number(obj.propertyAppreciation)
        if (!Number.isFinite(pv) || !Number.isFinite(pa)) {
            throw new Error("Gemini returned invalid numeric values")
        }
        return { propertyValue: pv, propertyAppreciation: pa }
    } catch (err) {
        console.error("[onboarding/estimate-value] parse error:", err, "raw:", text)
        throw new Error("Falha ao interpretar resposta do Gemini")
    }
}
