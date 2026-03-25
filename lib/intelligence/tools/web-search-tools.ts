// ============================================
// WEB SEARCH TOOLS
// External intelligence via Google Search (Gemini grounding)
// ============================================

import type { ToolDefinition, ToolResult } from '../types'
import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
const genAI = new GoogleGenerativeAI(GEMINI_KEY)

export const webSearchTools: ToolDefinition[] = [
  {
    name: 'web_search',
    description:
      'Busca informacoes na internet usando Google Search. Use para: eventos em uma cidade/periodo, precos de imoveis em sites como OLX/Zap, noticias do mercado imobiliario, turismo, alta temporada, feriados, atrações locais. Retorna informacoes atualizadas da web.',
    parameters: {
      query: {
        type: 'string',
        description: 'A consulta de busca (em portugues). Seja especifico. Ex: "eventos em Porto de Galinhas abril 2026", "preco aluguel temporada Maragogi 2 quartos"',
        required: true,
      },
      context: {
        type: 'string',
        description: 'Contexto adicional para refinar a busca (opcional). Ex: "preciso saber para ajustar precificacao"',
        required: false,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['market', 'analyst', 'pricing', 'operations'],
    execute: async (params): Promise<ToolResult> => {
      try {
        const query = String(params.query || '')
        if (!query) {
          return { success: false, error: 'Query de busca obrigatoria', summary: 'Query vazia.' }
        }

        if (!GEMINI_KEY) {
          return { success: false, error: 'GEMINI_API_KEY nao configurada', summary: 'API key ausente.' }
        }

        // Use Gemini with Google Search grounding
        const model = genAI.getGenerativeModel({
          model: 'gemini-flash-latest',
          tools: [{ googleSearch: {} } as any],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        })

        const contextInfo = params.context ? `\nContexto: ${params.context}` : ''
        const prompt = `Voce e um assistente de pesquisa para uma empresa de gestao de propriedades de aluguel por temporada (short-stay) no Nordeste do Brasil.

Pesquise na internet e responda sobre: ${query}${contextInfo}

INSTRUCOES:
- Forneca informacoes factuais e atualizadas
- Inclua fontes quando possivel
- Se for sobre precos, formate em BRL (R$)
- Se for sobre eventos, inclua datas, local e relevancia para turismo
- Se for sobre mercado imobiliario, inclua faixa de precos e tendencias
- Seja objetivo e estruturado`

        const result = await model.generateContent(prompt)
        const response = result.response
        const text = response.text()

        // Extract grounding metadata if available
        const candidate = response.candidates?.[0]
        const groundingMeta = candidate?.groundingMetadata
        const sources: string[] = []

        if (groundingMeta) {
          // Extract search entry point and web sources
          const chunks = groundingMeta.groundingChunks || []
          for (const chunk of chunks) {
            if (chunk.web?.uri && chunk.web?.title) {
              sources.push(`${chunk.web.title}: ${chunk.web.uri}`)
            }
          }
        }

        const sourcesText = sources.length > 0
          ? `\n\nFontes consultadas:\n${sources.slice(0, 5).map((s, i) => `${i + 1}. ${s}`).join('\n')}`
          : ''

        return {
          success: true,
          data: {
            response: text,
            sources: sources.slice(0, 5),
            query,
          },
          summary: `Pesquisa web: "${query}". ${sources.length} fonte(s) encontrada(s).${sourcesText}`,
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'

        // Handle specific errors
        if (errorMsg.includes('API key')) {
          return { success: false, error: 'GEMINI_API_KEY invalida ou sem permissao para Google Search', summary: 'Erro de autenticacao.' }
        }

        return {
          success: false,
          error: errorMsg,
          summary: `Falha na pesquisa web: ${errorMsg}`,
        }
      }
    },
  },
  {
    name: 'search_events',
    description:
      'Busca eventos, feriados e acontecimentos em uma cidade/regiao para um periodo especifico. Util para prever demanda e ajustar precos.',
    parameters: {
      location: {
        type: 'string',
        description: 'Cidade ou regiao (ex: "Porto de Galinhas", "Recife", "Joao Pessoa")',
        required: true,
      },
      period: {
        type: 'string',
        description: 'Periodo de interesse (ex: "abril 2026", "carnaval 2026", "proximas 2 semanas")',
        required: true,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['market', 'analyst', 'pricing', 'operations'],
    execute: async (params): Promise<ToolResult> => {
      try {
        const location = String(params.location || '')
        const period = String(params.period || '')

        if (!location || !period) {
          return { success: false, error: 'Location e period sao obrigatorios', summary: 'Parametros ausentes.' }
        }

        if (!GEMINI_KEY) {
          return { success: false, error: 'GEMINI_API_KEY nao configurada', summary: 'API key ausente.' }
        }

        const model = genAI.getGenerativeModel({
          model: 'gemini-flash-latest',
          tools: [{ googleSearch: {} } as any],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        })

        const prompt = `Pesquise eventos, feriados, festivais e acontecimentos em ${location} durante ${period}.

INSTRUCOES:
- Liste todos os eventos relevantes encontrados
- Para cada evento inclua: nome, data(s), tipo (festival, feriado, esportivo, cultural), impacto esperado no turismo (alto/medio/baixo)
- Inclua feriados nacionais e locais que caem nesse periodo
- Mencione se ha alta temporada ou periodo de pico
- Se nao encontrar eventos especificos, mencione a sazonalidade tipica da regiao
- Estruture a resposta em formato de lista

Contexto: Esta informacao sera usada para ajustar a precificacao de propriedades de aluguel por temporada na regiao.`

        const result = await model.generateContent(prompt)
        const response = result.response
        const text = response.text()

        const candidate = response.candidates?.[0]
        const groundingMeta = candidate?.groundingMetadata
        const sources: string[] = []

        if (groundingMeta) {
          const chunks = groundingMeta.groundingChunks || []
          for (const chunk of chunks) {
            if (chunk.web?.uri && chunk.web?.title) {
              sources.push(`${chunk.web.title}: ${chunk.web.uri}`)
            }
          }
        }

        return {
          success: true,
          data: {
            response: text,
            location,
            period,
            sources: sources.slice(0, 5),
          },
          summary: `Eventos em ${location} (${period}): pesquisa concluida. ${sources.length} fonte(s).`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
          summary: 'Falha ao buscar eventos.',
        }
      }
    },
  },
  {
    name: 'search_market_prices',
    description:
      'Pesquisa precos de mercado imobiliario e aluguel por temporada em sites como OLX, Zap Imoveis, Airbnb publico. Util para posicionamento de preco.',
    parameters: {
      location: {
        type: 'string',
        description: 'Cidade ou bairro (ex: "Porto de Galinhas", "Boa Viagem Recife")',
        required: true,
      },
      property_type: {
        type: 'string',
        description: 'Tipo de imovel (ex: "apartamento 2 quartos", "casa beira-mar", "flat")',
        required: false,
      },
      purpose: {
        type: 'string',
        description: 'Tipo de busca: "temporada" (aluguel curto), "venda" (compra/venda), "aluguel_fixo" (mensal)',
        required: false,
        enum: ['temporada', 'venda', 'aluguel_fixo'],
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['market', 'pricing', 'analyst'],
    execute: async (params): Promise<ToolResult> => {
      try {
        const location = String(params.location || '')
        if (!location) {
          return { success: false, error: 'Location e obrigatorio', summary: 'Parametro ausente.' }
        }

        if (!GEMINI_KEY) {
          return { success: false, error: 'GEMINI_API_KEY nao configurada', summary: 'API key ausente.' }
        }

        const propertyType = params.property_type ? String(params.property_type) : 'apartamento'
        const purpose = params.purpose ? String(params.purpose) : 'temporada'

        const purposeMap: Record<string, string> = {
          temporada: 'aluguel por temporada (diaria/semanal)',
          venda: 'venda de imoveis',
          aluguel_fixo: 'aluguel fixo mensal',
        }

        const model = genAI.getGenerativeModel({
          model: 'gemini-flash-latest',
          tools: [{ googleSearch: {} } as any],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        })

        const prompt = `Pesquise precos de ${purposeMap[purpose] || 'aluguel por temporada'} para ${propertyType} em ${location}, Brasil.

INSTRUCOES:
- Busque em sites como OLX, Zap Imoveis, Viva Real, Airbnb, Booking
- Forneca faixa de precos (minimo, medio, maximo) em BRL (R$)
- Se for temporada, use preco por noite
- Se for venda, use preco total do imovel
- Se for aluguel fixo, use preco mensal
- Mencione a fonte dos dados
- Inclua tendencia do mercado se disponivel (subindo, estavel, caindo)
- Compare com regioes similares se possivel

Contexto: Uma gestora de propriedades de short-stay precisa entender o posicionamento de precos na regiao.`

        const result = await model.generateContent(prompt)
        const response = result.response
        const text = response.text()

        const candidate = response.candidates?.[0]
        const groundingMeta = candidate?.groundingMetadata
        const sources: string[] = []

        if (groundingMeta) {
          const chunks = groundingMeta.groundingChunks || []
          for (const chunk of chunks) {
            if (chunk.web?.uri && chunk.web?.title) {
              sources.push(`${chunk.web.title}: ${chunk.web.uri}`)
            }
          }
        }

        return {
          success: true,
          data: {
            response: text,
            location,
            property_type: propertyType,
            purpose,
            sources: sources.slice(0, 5),
          },
          summary: `Precos de mercado em ${location} (${propertyType}, ${purpose}): pesquisa concluida. ${sources.length} fonte(s).`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
          summary: 'Falha ao buscar precos de mercado.',
        }
      }
    },
  },
]
