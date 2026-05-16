/**
 * Orquestrador do pipeline de Onboarding.
 *
 * Modelo de fases:
 *   fila → processamento_ia → revisao → aprovacao → concluido
 *
 * runEnrichment cobre processamento_ia → revisao:
 *   - F2 (cálculos): BQ, similares, Gemini, estatísticas, metas, financeira
 *   - F3 (artefato Estudo): PDF + Drive (sem Jestor/Slack — esses vão pra "Concluir")
 *   - F4 (artefato Pitchdeck): busca contato, gera PDF, sobe Drive (sem email — vai pra "Concluir")
 *   - F6 (sugestões): basket, baserate, sazonalidades, match Airbnb
 *
 * Ações externas (email proprietário, atualização Jestor, Slack pricing,
 * Slack pitchdeck) são disparadas apenas quando o operador transiciona
 * o card para "concluido" via `runConclusion()` em [./conclude.ts].
 */

import { logEvent, transitionState, updateOnboarding } from "./repository"
import { hydrateBq } from "./steps/01-hydrate-bq"
import { findSimilar } from "./steps/02-find-similar"
import { estimateValue } from "./steps/03-estimate-value"
import { pracaStats } from "./steps/04-praca-stats"
import { calculateTargets } from "./steps/05-calculate-targets"
import { financialAnalysis } from "./steps/06-financial-analysis"
import { generatePricingPdf } from "./steps/07-generate-pricing-pdf"
import { fetchOwnerContact } from "./steps/10-fetch-owner-contact"
import { generatePitchdeck } from "./steps/12-generate-pitchdeck"
import { suggestBasket } from "./steps/14-suggest-basket"
import { suggestBaserate } from "./steps/15-suggest-baserate"
import { suggestSazonalidades } from "./steps/16-suggest-sazonalidades"
import { matchAirbnb } from "./steps/17-match-airbnb"
import type { JestorPayload, OnboardingState, PipelineContext } from "./types"

export interface RunResult {
    ok: boolean
    onboardingId: string
    idpropriedade: string
    finalState: OnboardingState
    error?: string
}

export async function runEnrichment(
    onboardingId: string,
    idpropriedade: string,
    payload: JestorPayload
): Promise<RunResult> {
    let ctx: PipelineContext = { onboardingId, idpropriedade, payload }

    try {
        await transitionState(onboardingId, idpropriedade, "processamento_ia")
        await logEvent(onboardingId, idpropriedade, "enrichment_started")

        // ---- F2 cálculos ----
        ctx = await hydrateBq(ctx)
        await logEvent(onboardingId, idpropriedade, "bq_hydrated", {
            found: !!ctx.bq,
            sub_grupo: ctx.bq?.sub_grupo,
        })
        await updateOnboarding(onboardingId, {
            bq_snapshot: ctx.bq as unknown as Record<string, unknown> | null,
        })

        ctx = await findSimilar(ctx)
        await logEvent(onboardingId, idpropriedade, "similar_found", { count: ctx.similar?.length || 0 })
        await updateOnboarding(onboardingId, {
            similar_properties: { items: ctx.similar || [] } as Record<string, unknown>,
        })

        ctx = await estimateValue(ctx)
        await logEvent(onboardingId, idpropriedade, "value_estimated", ctx.estimate as unknown as Record<string, unknown>)
        await updateOnboarding(onboardingId, {
            property_value: ctx.estimate?.propertyValue ?? null,
            property_appreciation: ctx.estimate?.propertyAppreciation ?? null,
        })

        ctx = await pracaStats(ctx)
        await logEvent(onboardingId, idpropriedade, "praca_stats_loaded", {
            praca: ctx.pracaStats?.praca,
            meses: ctx.pracaStats?.detalhamento_mensal.length || 0,
        })

        ctx = calculateTargets(ctx)
        await logEvent(onboardingId, idpropriedade, "targets_calculated", { meta_anual: ctx.metaAnual })
        await updateOnboarding(onboardingId, {
            meta_anual: ctx.metaAnual ?? null,
            meta_distribuicao_mensal: { items: ctx.metaDistribuicao || [] } as Record<string, unknown>,
        })

        ctx = financialAnalysis(ctx)
        await logEvent(onboardingId, idpropriedade, "financial_analysis_done", {
            valor_liquido_anual: ctx.analiseFinanceira?.resumo_anual.valor_liquido_anual,
            roi: ctx.analiseFinanceira?.resumo_anual.rentabilidade_total_anual_perc,
        })
        await updateOnboarding(onboardingId, {
            analise_financeira: ctx.analiseFinanceira as unknown as Record<string, unknown>,
            enriched_at: new Date().toISOString(),
        })

        // ---- F3 artefato Estudo (sem Jestor/Slack — fica pra Concluir) ----
        try {
            const pdfResult = await generatePricingPdf(ctx)
            await logEvent(onboardingId, idpropriedade, "pdf_generated", {
                file_id: pdfResult.fileId,
                url: pdfResult.webViewLink,
                dryRun: pdfResult.dryRun,
            })
            await updateOnboarding(onboardingId, {
                pdf_url: pdfResult.webViewLink,
                pdf_drive_file_id: pdfResult.fileId,
                pdf_generated_at: new Date().toISOString(),
            })
        } catch (err) {
            await logEvent(onboardingId, idpropriedade, "pdf_failed", {
                error: err instanceof Error ? err.message : String(err),
            })
        }

        // ---- F4 artefato Pitchdeck (sem email — fica pra Concluir) ----
        try {
            const ownerContact = await fetchOwnerContact(ctx)
            await logEvent(onboardingId, idpropriedade, "owner_contact_fetched", {
                hasEmail: !!ownerContact?.email,
                hasName: !!ownerContact?.name,
            })
            if (ownerContact) {
                await updateOnboarding(onboardingId, {
                    owner_name: ownerContact.name,
                    owner_email: ownerContact.email,
                    owner_phone: ownerContact.telefone,
                })

                try {
                    const pitch = await generatePitchdeck(ownerContact)
                    await logEvent(onboardingId, idpropriedade, "pitchdeck_generated", {
                        file_id: pitch.fileId,
                        url: pitch.webViewLink,
                        dryRun: pitch.dryRun,
                    })
                    await updateOnboarding(onboardingId, {
                        pitchdeck_pdf_url: pitch.webViewLink,
                        pitchdeck_drive_file_id: pitch.fileId,
                        pitchdeck_generated_at: new Date().toISOString(),
                    })
                } catch (err) {
                    await logEvent(onboardingId, idpropriedade, "pitchdeck_failed", {
                        error: err instanceof Error ? err.message : String(err),
                    })
                }
            }
        } catch (err) {
            await logEvent(onboardingId, idpropriedade, "owner_contact_failed", {
                error: err instanceof Error ? err.message : String(err),
            })
        }

        // ---- F6 sugestões (basket, baserate, sazonalidades, Airbnb) ----
        const [basketRes, baserateRes, sazonalRes, airbnbRes] = await Promise.allSettled([
            suggestBasket(ctx),
            suggestBaserate(ctx),
            suggestSazonalidades(ctx),
            matchAirbnb(ctx),
        ])

        const suggestionsPatch: Record<string, unknown> = {}
        if (basketRes.status === "fulfilled" && basketRes.value) {
            suggestionsPatch.suggested_basket = basketRes.value as unknown as Record<string, unknown>
        }
        if (baserateRes.status === "fulfilled" && baserateRes.value != null) {
            suggestionsPatch.suggested_baserate = baserateRes.value
        }
        if (sazonalRes.status === "fulfilled" && sazonalRes.value) {
            suggestionsPatch.suggested_sazonalidades = sazonalRes.value as unknown as Record<string, unknown>
        }
        if (airbnbRes.status === "fulfilled" && airbnbRes.value?.url_anuncio) {
            suggestionsPatch.matched_airbnb_listing = airbnbRes.value.url_anuncio
        }
        if (Object.keys(suggestionsPatch).length) {
            await updateOnboarding(onboardingId, suggestionsPatch)
        }
        await logEvent(onboardingId, idpropriedade, "suggestions_generated", {
            basket_items: basketRes.status === "fulfilled" ? basketRes.value?.items.length || 0 : 0,
            baserate: baserateRes.status === "fulfilled" ? baserateRes.value : null,
            sazonalidade: sazonalRes.status === "fulfilled" ? sazonalRes.value?.seasonality_name : null,
            airbnb_match: airbnbRes.status === "fulfilled" ? !!airbnbRes.value : false,
        })

        // Pipeline terminou. Card vai pra Revisão (operador analisa).
        await transitionState(onboardingId, idpropriedade, "revisao", {
            revisao_since: new Date().toISOString(),
        })
        await logEvent(onboardingId, idpropriedade, "enrichment_done")

        return {
            ok: true,
            onboardingId,
            idpropriedade,
            finalState: "revisao",
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error("[onboarding/pipeline] runEnrichment error:", err)
        await logEvent(onboardingId, idpropriedade, "error", { message })
        return {
            ok: false,
            onboardingId,
            idpropriedade,
            finalState: "processamento_ia",
            error: message,
        }
    }
}

/**
 * Dispara o pipeline em background com waitUntil em produção Vercel.
 */
export function runEnrichmentInBackground(
    onboardingId: string,
    idpropriedade: string,
    payload: JestorPayload
): void {
    const job = runEnrichment(onboardingId, idpropriedade, payload).catch((err) => {
        console.error("[onboarding/pipeline] background error:", err)
    })

    if (process.env.VERCEL === "1") {
        import("@vercel/functions")
            .then(({ waitUntil }) => waitUntil(job))
            .catch((err) => {
                console.error("[onboarding/pipeline] waitUntil unavailable:", err)
            })
    }
}
