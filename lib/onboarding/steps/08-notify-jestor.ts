/**
 * Step 8: Atualiza o registro na Jestor com o link do PDF do Estudo.
 *
 * Replica o node "Atualizar na Jestor" do workflow n8n. Em dry-run só loga.
 */

import { isDryRun } from "../constants"
import type { PipelineContext } from "../types"

export interface NotifyJestorResult {
    skipped: boolean
    statusCode?: number
    body?: unknown
}

const JESTOR_URL = "https://quartoavista.api.jestor.fun/object/update"
const JESTOR_OBJECT_TYPE = "defa6ad003d6d8f81205a"

export async function notifyJestor(
    ctx: PipelineContext,
    pdfWebViewLink: string
): Promise<NotifyJestorResult> {
    if (isDryRun()) {
        console.log("[onboarding/notify-jestor] DRY-RUN — payload:", {
            object_type: JESTOR_OBJECT_TYPE,
            id: ctx.payload.recordid,
            link_2: pdfWebViewLink,
        })
        return { skipped: true }
    }

    const token = process.env.JESTOR_BEARER_TOKEN
    if (!token) {
        throw new Error(
            "JESTOR_BEARER_TOKEN env var é obrigatória quando dry-run está OFF"
        )
    }
    if (!ctx.payload.recordid) {
        throw new Error("recordid ausente no payload Jestor — não dá pra atualizar")
    }

    const res = await fetch(JESTOR_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            object_type: JESTOR_OBJECT_TYPE,
            data: {
                [`id_${JESTOR_OBJECT_TYPE}`]: Number(ctx.payload.recordid),
                link_2: pdfWebViewLink,
            },
        }),
    })

    let body: unknown = null
    try {
        body = await res.json()
    } catch {
        body = await res.text()
    }

    if (!res.ok) {
        throw new Error(
            `Jestor update falhou: ${res.status} ${typeof body === "string" ? body : JSON.stringify(body)}`
        )
    }

    return { skipped: false, statusCode: res.status, body }
}
