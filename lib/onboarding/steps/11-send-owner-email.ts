/**
 * Step 11: Envia e-mail de boas-vindas Qavi.imob ao proprietário.
 *
 * Pula se não houver e-mail. Em dry-run apenas loga.
 */

import { sendEmail } from "../gmail"
import {
    ownerWelcomeSubject,
    renderOwnerWelcomeEmail,
} from "../templates/owner-welcome-email"
import type { OwnerContact } from "./10-fetch-owner-contact"

export interface SendOwnerEmailResult {
    skipped: boolean
    reason?: string
    messageId?: string
}

export async function sendOwnerEmail(
    contact: OwnerContact
): Promise<SendOwnerEmailResult> {
    if (!contact.email) {
        return { skipped: true, reason: "owner_email_missing" }
    }

    const html = renderOwnerWelcomeEmail({
        ownerName: contact.name || "Proprietário",
        nomePropriedade: contact.nomePropriedade || contact.idpropriedade,
        idPropriedade: contact.idpropriedade,
    })

    const result = await sendEmail({
        to: contact.email,
        subject: ownerWelcomeSubject(contact.idpropriedade),
        htmlBody: html,
    })

    return {
        skipped: result.skipped,
        reason: result.skipped ? "dry_run" : undefined,
        messageId: result.messageId,
    }
}
