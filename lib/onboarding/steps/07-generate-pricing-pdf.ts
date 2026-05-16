/**
 * Step 7: Renderiza o Estudo de Rentabilidade (HTML → PDF) e faz upload
 * no Drive (com dry-run para testes locais).
 */

import { DRIVE_FOLDERS_BY_PRACA } from "../constants"
import { uploadToDrive } from "../drive"
import { htmlToPdfBuffer } from "../pdf"
import {
    renderPricingStudyHtml,
    type PricingStudyData,
} from "../templates/pricing-study"
import type { PipelineContext } from "../types"

export interface GeneratePricingPdfResult {
    fileId: string
    webViewLink: string
    dryRun: boolean
}

export async function generatePricingPdf(
    ctx: PipelineContext
): Promise<GeneratePricingPdfResult> {
    if (!ctx.estimate || !ctx.metaAnual || !ctx.metaDistribuicao || !ctx.analiseFinanceira) {
        throw new Error("Pipeline incompleto: estimate/metaAnual/distribuicao/analise ausentes")
    }

    const data: PricingStudyData = {
        payload: ctx.payload,
        bq: ctx.bq || null,
        propertyValue: ctx.estimate.propertyValue,
        propertyAppreciation: ctx.estimate.propertyAppreciation,
        metaAnual: ctx.metaAnual,
        distribuicao: ctx.metaDistribuicao,
        analise: ctx.analiseFinanceira,
    }

    const html = renderPricingStudyHtml(data)
    const pdf = await htmlToPdfBuffer(html, { landscape: false })

    const praca = ctx.payload.localidade || ctx.bq?.praca || "Maceió"
    const folderId =
        DRIVE_FOLDERS_BY_PRACA[praca] ||
        DRIVE_FOLDERS_BY_PRACA["Maceió"] // fallback p/ pasta principal

    const baseName =
        (ctx.bq?.nomepropriedade || ctx.payload.propriedade || ctx.idpropriedade) +
        " - Estudo de Rentabilidade"

    const upload = await uploadToDrive({
        fileName: `${baseName}.pdf`,
        folderId,
        mimeType: "application/pdf",
        content: pdf,
    })

    return upload
}
