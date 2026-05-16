/**
 * Proxies n8n para notificações (Slack e Gmail).
 *
 * Em vez de duplicar credenciais OAuth do Slack/Gmail no Vercel, o
 * Price.OS POSTa nos 2 workflows n8n [Price.OS Proxy] que reusam as
 * credenciais já configuradas lá. Header `x-priceos-token` autentica.
 *
 * URLs vivem em N8N_SLACK_PROXY_URL e N8N_GMAIL_PROXY_URL.
 * Token compartilhado vive em PRICEOS_PROXY_TOKEN (mesmo valor hardcoded
 * no node "Check Auth" dos workflows n8n).
 */

const DEFAULT_SLACK_URL = "https://n8n.quartoavista.com.br/webhook/priceos-slack"
const DEFAULT_GMAIL_URL = "https://n8n.quartoavista.com.br/webhook/priceos-gmail"

function token(): string {
    const t = process.env.PRICEOS_PROXY_TOKEN
    if (!t) throw new Error("PRICEOS_PROXY_TOKEN env var é obrigatória para proxies n8n")
    return t
}

export interface PostSlackResult {
    skipped: false
    ts?: string
}

export async function postSlackViaProxy(
    channelId: string,
    text: string
): Promise<PostSlackResult> {
    const url = process.env.N8N_SLACK_PROXY_URL || DEFAULT_SLACK_URL
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-priceos-token": token(),
        },
        body: JSON.stringify({ channel: channelId, text }),
    })
    if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`n8n Slack proxy falhou: ${res.status} ${body.slice(0, 200)}`)
    }
    // n8n responde com o payload do node Slack; tentamos extrair ts mas não falhamos
    let ts: string | undefined
    try {
        const json = (await res.json()) as unknown
        if (Array.isArray(json) && json.length > 0) {
            const first = json[0] as { ts?: string }
            ts = first?.ts
        }
    } catch {
        // sem corpo JSON, ok
    }
    return { skipped: false, ts }
}

export interface PostGmailResult {
    skipped: false
    messageId?: string
}

export async function sendEmailViaProxy(
    to: string,
    subject: string,
    htmlBody: string
): Promise<PostGmailResult> {
    const url = process.env.N8N_GMAIL_PROXY_URL || DEFAULT_GMAIL_URL
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-priceos-token": token(),
        },
        body: JSON.stringify({ to, subject, html: htmlBody }),
    })
    if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`n8n Gmail proxy falhou: ${res.status} ${body.slice(0, 200)}`)
    }
    let messageId: string | undefined
    try {
        const json = (await res.json()) as unknown
        if (Array.isArray(json) && json.length > 0) {
            const first = json[0] as { id?: string }
            messageId = first?.id
        }
    } catch {
        // sem corpo JSON, ok
    }
    return { skipped: false, messageId }
}
