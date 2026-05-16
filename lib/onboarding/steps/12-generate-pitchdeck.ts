/**
 * Step 12: Renderiza o Pitchdeck Qavi.imob (7 slides A4 landscape) e
 * faz upload na pasta única "1. Pitchdecks" do Drive.
 */

import { DRIVE_FOLDER_PITCHDECKS } from "../constants"
import { uploadToDrive, type DriveUploadResult } from "../drive"
import { htmlToPdfBuffer } from "../pdf"
import {
    pitchdeckFileName,
    renderOwnerPitchdeckHtml,
} from "../templates/owner-pitchdeck"
import type { OwnerContact } from "./10-fetch-owner-contact"

export async function generatePitchdeck(
    contact: OwnerContact
): Promise<DriveUploadResult> {
    const html = renderOwnerPitchdeckHtml({
        ownerName: contact.name || "Proprietário",
        nomePropriedade: contact.nomePropriedade || contact.idpropriedade,
        idPropriedade: contact.idpropriedade,
    })

    const pdf = await htmlToPdfBuffer(html, { landscape: true })

    return uploadToDrive({
        fileName: pitchdeckFileName(contact.nomePropriedade || contact.idpropriedade),
        folderId: DRIVE_FOLDER_PITCHDECKS,
        mimeType: "application/pdf",
        content: pdf,
    })
}
