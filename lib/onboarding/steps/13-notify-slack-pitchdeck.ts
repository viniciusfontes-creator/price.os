/**
 * Step 13: Notifica Slack #onboarding-precificação que o Pitchdeck foi gerado.
 *
 * Espelho do node "Notificar Slack" do sub-workflow [Owner] Apresentação.
 */

import { isDryRun, SLACK_CHANNEL_ONBOARDING } from "../constants"
import type { OwnerContact } from "./10-fetch-owner-contact"

export interface NotifySlackPitchdeckResult {
    skipped: boolean
    ts?: string
}

export async function notifySlackPitchdeck(
    contact: OwnerContact,
    pdfWebViewLink: string
): Promise<NotifySlackPitchdeckResult> {
    const text = `*Pitchdeck Qavi.imob pronto!*

*Unidade:* ${contact.nomePropriedade || contact.idpropriedade}
*Proprietário:* ${contact.name || "—"}
*PDF:* ${pdfWebViewLink}`

    if (isDryRun()) {
        console.log(
            `[onboarding/notify-slack-pitchdeck] DRY-RUN — channel=${SLACK_CHANNEL_ONBOARDING}\n${text}`
        )
        return { skipped: true }
    }

    const token = process.env.SLACK_BOT_TOKEN
    if (!token) {
        throw new Error("SLACK_BOT_TOKEN ausente quando dry-run está OFF")
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
