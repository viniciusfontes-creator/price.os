// ============================================
// OPENROUTER CLIENT
// Centralized OpenAI-compatible client via OpenRouter
// ============================================

import OpenAI from 'openai'

// Model to use across all agents
export const GEMINI_MODEL = 'google/gemini-2.5-flash-preview'

let _client: OpenAI | null = null

export function getOpenRouterClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENROUTER_API_KEY || ''
    if (!apiKey) {
      console.warn('[OpenRouter] OPENROUTER_API_KEY not set')
    }
    _client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://qavi-dashboard.vercel.app',
        'X-Title': 'Price.OS Intelligence',
      },
    })
  }
  return _client
}
