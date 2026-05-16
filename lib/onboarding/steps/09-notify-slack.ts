/**
 * Step 9: Notifica Slack #onboarding-precificação com link do PDF.
 *
 * Em dry-run só loga. Usa a Web API "chat.postMessage" via fetch direto
 * para evitar dependência adicional.
 */

import { isDryRun, SLACK_CHANNEL_ONBOARDING } from "../constants"
import type { PipelineContext } from "../types"

export interface NotifySlackResult {
    skipped: boolean
    ts?: string
    error?: string
}

export async function notifySlackPricing(
    ctx: PipelineContext,
    pdfWebViewLink: string
): Promise<NotifySlackResult> {
    const text = buildPricingMessage(ctx, pdfWebViewLink)

    if (isDryRun()) {
        console.log(
            `[onboarding/notify-slack] DRY-RUN — channel=${SLACK_CHANNEL_ONBOARDING}\n${text}`
        )
        return { skipped: true }
    }

    const token = process.env.SLACK_BOT_TOKEN
    if (!token) {
        throw new Error("SLACK_BOT_TOKEN env var é obrigatória quando dry-run está OFF")
    }

    const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
            channel: SLACK_CHANNEL_ONBOARDING,
            text,
            unfurl_links: false,
        }),
    })

    const body = (await res.json()) as { ok: boolean; ts?: string; error?: string }
    if (!body.ok) {
        throw new Error(`Slack postMessage failed: ${body.error || res.statusText}`)
    }
    return { skipped: false, ts: body.ts }
}

function buildPricingMessage(
    ctx: PipelineContext,
    pdfWebViewLink: string
): string {
    const nome =
        ctx.payload.propriedade ||
        ctx.bq?.nomepropriedade ||
        ctx.idpropriedade
    return `*Precificação e Estudo de Rentabilidade Pronto!*

*Unidade:* ${nome}

*Estudo de Rentabilidade:* ${pdfWebViewLink}`
}
