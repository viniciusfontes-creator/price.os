// ============================================
// WEB SEARCH TOOLS
// External intelligence via OpenRouter (Gemini)
// ============================================

import type { ToolDefinition, ToolResult } from '../types'
import { getOpenRouterClient, GEMINI_MODEL } from '../openrouter-client'

export const webSearchTools: ToolDefinition[] = [
  {
    name: 'web_search',
    description:
      'Busca informacoes na internet usando IA. Use para: eventos em uma cidade/periodo, precos de imoveis, noticias do mercado imobiliario, turismo, alta temporada, feriados, atrações locais. Retorna informacoes baseadas no conhecimento do modelo.',
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

        const client = getOpenRouterClient()
        const contextInfo = params.context ? `\nContexto: ${params.context}` : ''

        const result = await client.chat.completions.create({
          model: GEMINI_MODEL,
          temperature: 0.3,
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: `Voce e um assistente de pesquisa para uma empresa de gestao de propriedades de aluguel por temporada (short-stay) no Nordeste do Brasil.

Pesquise e responda sobre: ${query}${contextInfo}

INSTRUCOES:
- Forneca informacoes factuais e atualizadas com base no seu conhecimento
- Se for sobre precos, formate em BRL (R$)
- Se for sobre eventos, inclua datas, local e relevancia para turismo
- Se for sobre mercado imobiliario, inclua faixa de precos e tendencias
- Seja objetivo e estruturado`,
          }],
        })

        const text = result.choices[0]?.message?.content || ''

        return {
          success: true,
          data: {
            response: text,
            sources: [],
            query,
          },
          summary: `Pesquisa: "${query}". Resposta obtida com sucesso.`,
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'
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

        const client = getOpenRouterClient()

        const result = await client.chat.completions.create({
          model: GEMINI_MODEL,
          temperature: 0.3,
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: `Pesquise eventos, feriados, festivais e acontecimentos em ${location} durante ${period}.

INSTRUCOES:
- Liste todos os eventos relevantes conhecidos
- Para cada evento inclua: nome, data(s), tipo (festival, feriado, esportivo, cultural), impacto esperado no turismo (alto/medio/baixo)
- Inclua feriados nacionais e locais que caem nesse periodo
- Mencione se ha alta temporada ou periodo de pico
- Se nao encontrar eventos especificos, mencione a sazonalidade tipica da regiao
- Estruture a resposta em formato de lista

Contexto: Esta informacao sera usada para ajustar a precificacao de propriedades de aluguel por temporada na regiao.`,
          }],
        })

        const text = result.choices[0]?.message?.content || ''

        return {
          success: true,
          data: {
            response: text,
            location,
            period,
            sources: [],
          },
          summary: `Eventos em ${location} (${period}): pesquisa concluida.`,
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

        const propertyType = params.property_type ? String(params.property_type) : 'apartamento'
        const purpose = params.purpose ? String(params.purpose) : 'temporada'

        const purposeMap: Record<string, string> = {
          temporada: 'aluguel por temporada (diaria/semanal)',
          venda: 'venda de imoveis',
          aluguel_fixo: 'aluguel fixo mensal',
        }

        const client = getOpenRouterClient()

        const result = await client.chat.completions.create({
          model: GEMINI_MODEL,
          temperature: 0.3,
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: `Pesquise precos de ${purposeMap[purpose] || 'aluguel por temporada'} para ${propertyType} em ${location}, Brasil.

INSTRUCOES:
- Forneca faixa de precos (minimo, medio, maximo) em BRL (R$)
- Se for temporada, use preco por noite
- Se for venda, use preco total do imovel
- Se for aluguel fixo, use preco mensal
- Inclua tendencia do mercado se conhecido (subindo, estavel, caindo)
- Compare com regioes similares se possivel

Contexto: Uma gestora de propriedades de short-stay precisa entender o posicionamento de precos na regiao.`,
          }],
        })

        const text = result.choices[0]?.message?.content || ''

        return {
          success: true,
          data: {
            response: text,
            location,
            property_type: propertyType,
            purpose,
            sources: [],
          },
          summary: `Precos de mercado em ${location} (${propertyType}, ${purpose}): pesquisa concluida.`,
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
