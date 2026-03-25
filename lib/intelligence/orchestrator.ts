// ============================================
// ORCHESTRATOR
// Classifies intent and routes to agents
// ============================================

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AgentId } from '@/types/intelligence'
import type { BaseAgent } from './agents/base-agent'
import type { AgentContext, ClassificationResult, StreamCallback } from './types'
import { ORCHESTRATOR_CLASSIFICATION_PROMPT } from './prompts'
import { createAnalystAgent } from './agents/analyst'
import { createPricingAgent } from './agents/pricing'
import { createMarketAgent } from './agents/market'
import { createOperationsAgent } from './agents/operations'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// ── Strategy Detection ──────────────────────────────
// Complex queries get a pre-built execution plan injected into the agent prompt
const STRATEGY_PATTERNS: Array<{
  pattern: RegExp
  agentId: AgentId
  plan: string
}> = [
  {
    pattern: /mal\s*precificad|preco.*errad|precificacao.*errad|precos.*revisar|unidades.*precif/i,
    agentId: 'pricing',
    plan: `PLANO DE EXECUCAO OBRIGATORIO:
1. Use analyze_pricing_health com os filtros mencionados pelo usuario (praca, property_type)
2. Apresente tabela ordenada por PHS score com: propriedade, PHS, direcao (OVER/UNDER/ALIGNED), vitrine, sugerido, gap_meta, ocupacao
3. Para as top 3 piores, detalhe cada dimensao do score (D1-D5)
4. Se mencionou propriedade especifica, use tambem query_peer_comparison
5. Classifique cada uma com acao especifica`,
  },
  {
    pattern: /probabilidade.*alug|valor.*diaria.*conseguir|preco.*que.*vend|chance.*reserva|preco.*ideal.*(?:fds|fim.*semana|weekend)/i,
    agentId: 'pricing',
    plan: `PLANO DE EXECUCAO OBRIGATORIO:
1. Use query_property_details para identificar a propriedade, grupo e praca
2. Use query_historical_bookings com: grupo da propriedade, lead_time adequado (se mencionou FDS com poucos dias, use max_lead_time=7), day_of_week='weekend' se for FDS
3. Use query_peer_comparison para ver como peers no condominio estao precificados
4. Use query_competitors ou query_basket_prices para mediana de mercado do periodo
5. Sintetize: "Historicamente R$ X-Y, peers a R$ Z, mercado a R$ W → recomendo R$ V"`,
  },
  {
    pattern: /aumentar.*faturament|como.*faturar.*mais|onde.*focar.*esforco|maiores.*oportunidade/i,
    agentId: 'analyst',
    plan: `PLANO DE EXECUCAO OBRIGATORIO:
1. Use analyze_pricing_health para ver panorama completo de precificacao
2. Separe em 3 grupos de acao:
   a) OVERPRICED + gap alto → reduzir preco para gerar mais reservas
   b) UNDERPRICED + alta ocupacao → subir preco para mais receita por noite
   c) ALIGNED + gap → preco ok mas precisa preencher gaps no calendario
3. Use query_historical_bookings para validar se ADR sugerido converte na praca
4. Apresente plano de acao com R$ estimado de impacto por propriedade`,
  },
  {
    pattern: /compara.*com.*mercado|posicionad.*preco|benchmark|como.*estou.*vs|posicao.*mercado/i,
    agentId: 'market',
    plan: `PLANO DE EXECUCAO OBRIGATORIO:
1. Use query_property_details para identificar a propriedade
2. Use query_baskets para ver se tem cesta → se sim, query_basket_prices
3. Se nao tem cesta, use query_competitors com praca
4. Use query_peer_comparison para ver posicao no grupo
5. Apresente: nosso preco vs mediana mercado vs mediana peers, com % de diferenca e acao`,
  },
]

function detectStrategy(message: string): { agentId: AgentId; plan: string } | null {
  for (const strategy of STRATEGY_PATTERNS) {
    if (strategy.pattern.test(message)) {
      return { agentId: strategy.agentId, plan: strategy.plan }
    }
  }
  return null
}

export class Orchestrator {
  private agents: Map<AgentId, BaseAgent>

  constructor() {
    this.agents = new Map()
    this.agents.set('analyst', createAnalystAgent())
    this.agents.set('pricing', createPricingAgent())
    this.agents.set('market', createMarketAgent())
    this.agents.set('operations', createOperationsAgent())
  }

  async processMessage(
    message: string,
    context: AgentContext,
    callbacks: StreamCallback
  ): Promise<{ content: string; agentId: AgentId }> {
    // 1. Try strategy detection first (regex-based, instant)
    const strategy = detectStrategy(message)

    let agentId: AgentId
    let agentMessage: string

    if (strategy) {
      // Strategy detected — skip LLM classification, use pre-built plan
      agentId = strategy.agentId
      agentMessage = `[STRATEGY PLAN]\n${strategy.plan}\n\n[USER MESSAGE]\n${message}`
      callbacks.onAgentSwitch(null, agentId, `Estrategia detectada: analise avancada`)
    } else {
      // 2. Normal LLM classification
      const classification = await this.classifyIntent(message, context)
      agentId = classification.agentId
      agentMessage = message
      callbacks.onAgentSwitch(null, agentId, classification.reason)
    }

    // 3. Route to agent
    const agent = this.agents.get(agentId)
    if (!agent) {
      const fallback = this.agents.get('analyst')!
      const content = await fallback.process(agentMessage, context, callbacks)
      return { content, agentId: 'analyst' }
    }

    const content = await agent.process(agentMessage, context, callbacks)
    return { content, agentId }
  }

  private async classifyIntent(
    message: string,
    context: AgentContext
  ): Promise<ClassificationResult> {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200,
        },
      })

      // Include last 3 messages for context
      const recentHistory = context.conversationHistory
        .slice(-3)
        .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join('\n')

      const prompt = `${ORCHESTRATOR_CLASSIFICATION_PROMPT}

Historico recente:
${recentHistory || '(primeira mensagem)'}

Mensagem do usuario: ${message}`

      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const agentId = parsed.agentId as AgentId

        if (['analyst', 'pricing', 'market', 'operations'].includes(agentId)) {
          return {
            agentId,
            reason: parsed.reason || '',
            confidence: 0.9,
          }
        }
      }
    } catch (error) {
      console.error('Classification error:', error)
    }

    // Default to analyst
    return {
      agentId: 'analyst',
      reason: 'Fallback para analista (classificacao falhou)',
      confidence: 0.5,
    }
  }

  async generateTitle(
    userMessage: string,
    assistantResponse: string
  ): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { temperature: 0.3, maxOutputTokens: 30 },
      })

      const result = await model.generateContent(
        `Gere um titulo CURTO (maximo 5 palavras) em portugues para esta conversa. Responda APENAS com o titulo, sem formatacao markdown, sem asteriscos, sem aspas, sem pontuacao final.\n\nUsuario: ${userMessage.slice(0, 150)}\nAssistente: ${assistantResponse.slice(0, 150)}\n\nTitulo:`
      )

      const title = result.response.text().trim().replace(/[*#_`"]/g, '').slice(0, 50)
      return title || 'Nova conversa'
    } catch {
      return 'Nova conversa'
    }
  }
}
