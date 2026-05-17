/**
 * Cliente Google Drive (upload de PDFs).
 *
 * Em dry-run NÃO toca no Drive — apenas grava o arquivo em /tmp local e
 * retorna URL placeholder para o pipeline registrar no banco.
 */

import { promises as fs } from "fs"
import path from "path"
import { Readable } from "stream"
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

    // Reusa a service account já configurada para BigQuery (GCP_CLIENT_EMAIL +
    // GCP_PRIVATE_KEY). Em segundo lugar, aceita GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
    // para casos onde o admin do Drive optar por separar a credencial.
    const credentials = loadGoogleCredentials()
    if (!credentials) {
        throw new Error(
            "Credenciais Google ausentes: defina GCP_CLIENT_EMAIL+GCP_PRIVATE_KEY ou GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON"
        )
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"],
    })

    const drive = google.drive({ version: "v3", auth })

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

/**
 * Carrega as credenciais Google a partir das envs disponíveis. Prefere
 * o par GCP_CLIENT_EMAIL/GCP_PRIVATE_KEY (já em uso pelo BigQuery).
 */
function loadGoogleCredentials(): { client_email: string; private_key: string } | null {
    const clientEmail = process.env.GCP_CLIENT_EMAIL
    const privateKeyRaw = process.env.GCP_PRIVATE_KEY
    if (clientEmail && privateKeyRaw) {
        // Vercel armazena \n literal; restaurar quebras reais
        const privateKey = privateKeyRaw.replace(/\\n/g, "\n")
        return { client_email: clientEmail, private_key: privateKey }
    }

    const json = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
    if (json) {
        try {
            const parsed = JSON.parse(json) as { client_email?: string; private_key?: string }
            if (parsed.client_email && parsed.private_key) {
                return { client_email: parsed.client_email, private_key: parsed.private_key }
            }
        } catch (err) {
            console.error("[onboarding/drive] GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON inválido:", err)
        }
    }

    return null
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
