/**
 * Upload de PDFs no Google Drive.
 *
 * Caminho padrão (produção): POSTa no workflow n8n [Price.OS Proxy] Google
 * Drive upload, que reusa a credencial OAuth `Google Drive account` já
 * cadastrada lá. Evita o problema de "Service Accounts do not have storage
 * quota" quando se tenta criar arquivos em pastas de "Meu Drive" pela API
 * com service account.
 *
 * Caminho dry-run: grava o PDF em /tmp/onboarding-dryrun local e retorna
 * URL placeholder.
 */

import { promises as fs } from "fs"
import path from "path"
import { isDryRun } from "./constants"
import { uploadDriveViaProxy } from "./n8n-proxy"

export interface DriveUploadResult {
    fileId: string
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

    const r = await uploadDriveViaProxy(input)
    return { fileId: r.fileId, webViewLink: r.webViewLink, dryRun: false }
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
