/**
 * Cliente Google Drive (upload de PDFs).
 *
 * Em dry-run NÃO toca no Drive — apenas grava o arquivo em /tmp local e
 * retorna URL placeholder para o pipeline registrar no banco.
 */

import { promises as fs } from "fs"
import path from "path"
import { isDryRun } from "./constants"

export interface DriveUploadResult {
    /** ID do arquivo (ou "dry-run-<id>" no modo dry). */
    fileId: string
    /** URL para visualizar o arquivo. */
    webViewLink: string
    dryRun: boolean
}

interface UploadInput {
    fileName: string
    folderId: string
    mimeType: string
    content: Uint8Array
}

export async function uploadToDrive(input: UploadInput): Promise<DriveUploadResult> {
    if (isDryRun()) {
        return uploadLocalDryRun(input)
    }

    // Carregar SDK só quando for usar pra não onerar bundle
    const { google } = await import("googleapis")
    const credentialsRaw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
    if (!credentialsRaw) {
        throw new Error(
            "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON env var é obrigatória para upload em produção"
        )
    }

    let credentials: Record<string, unknown>
    try {
        credentials = JSON.parse(credentialsRaw)
    } catch (err) {
        throw new Error(`GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON inválido: ${(err as Error).message}`)
    }

    const auth = new google.auth.GoogleAuth({
        credentials: credentials as unknown as { client_email: string; private_key: string },
        scopes: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"],
    })

    const drive = google.drive({ version: "v3", auth })
    const { Readable } = await import("stream")

    const res = await drive.files.create({
        requestBody: {
            name: input.fileName,
            mimeType: input.mimeType,
            parents: [input.folderId],
        },
        media: {
            mimeType: input.mimeType,
            body: Readable.from(Buffer.from(input.content)),
        },
        fields: "id, webViewLink",
        supportsAllDrives: true,
    })

    return {
        fileId: res.data.id || "",
        webViewLink: res.data.webViewLink || "",
        dryRun: false,
    }
}

async function uploadLocalDryRun(input: UploadInput): Promise<DriveUploadResult> {
    const dir = path.join("/tmp", "onboarding-dryrun")
    try {
        await fs.mkdir(dir, { recursive: true })
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_")
        const filePath = path.join(dir, `${Date.now()}-${safeName}`)
        await fs.writeFile(filePath, input.content)
        const id = `dry-run-${path.basename(filePath)}`
        const url = `file://${filePath}`
        console.log(`[onboarding/drive] DRY-RUN — arquivo salvo em ${filePath}`)
        return { fileId: id, webViewLink: url, dryRun: true }
    } catch (err) {
        console.error("[onboarding/drive] dry-run write error:", err)
        return {
            fileId: "dry-run-failed",
            webViewLink: "about:blank",
            dryRun: true,
        }
    }
}
