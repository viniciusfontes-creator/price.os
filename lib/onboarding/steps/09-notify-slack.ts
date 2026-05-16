/**
 * Step 9: Notifica Slack #onboarding-precificação com link do PDF.
 *
 * Em dry-run só loga. Usa a Web API "chat.postMessage" via fetch direto
 * para evitar dependência adicional.
 */

import { isDryRun, SLACK_CHANNEL_ONBOARDING } from "../constants"
import { postSlackViaProxy } from "../n8n-proxy"
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

    return postSlackViaProxy(SLACK_CHANNEL_ONBOARDING, text)
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
