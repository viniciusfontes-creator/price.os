/**
 * Step 13: Notifica Slack #onboarding-precificação que o Pitchdeck foi gerado.
 *
 * Espelho do node "Notificar Slack" do sub-workflow [Owner] Apresentação.
 */

import { isDryRun, SLACK_CHANNEL_ONBOARDING } from "../constants"
import { postSlackViaProxy } from "../n8n-proxy"
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

    return postSlackViaProxy(SLACK_CHANNEL_ONBOARDING, text)
}
