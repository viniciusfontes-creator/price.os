
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { items } = body

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ success: false, error: 'Lista de itens inválida' }, { status: 400 })
        }

        // URL do Webhook do n8n fornecida pelo usuário
        const n8nWebhookUrl = 'https://n8n.quartoavista.com.br/webhook/market-monitor';

        // Dispara o webhook
        const response = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: items, // Envia o array de objetos { url, guests }
                triggered_at: new Date().toISOString(),
                source: 'market_monitor_basket'
            })
        })

        if (!response.ok) {
            throw new Error(`Erro ao chamar n8n: ${response.statusText}`)
        }

        return NextResponse.json({ success: true, message: 'Scraper disparado com sucesso' })

    } catch (error: any) {
        console.error('[API] Erro ao disparar scraper:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
