/**
 * Orquestrador do pipeline de Onboarding.
 *
 * F2 atual: roda steps 1-6 (hidratação BQ, similares, Gemini, stats da praça,
 * cálculo de metas, análise financeira). Após F2 o registro fica em estado
 * 'em_analise' com todos os dados calculados.
 *
 * F3+ adiciona: HTML/PDF do Estudo, Drive, Jestor, Slack, Apresentação ao
 * proprietário e sugestões Price.OS. Esses são plugados como steps adicionais
 * em runFullOnboarding().
 */

import { logEvent, transitionState, updateOnboarding } from "./repository"
import { hydrateBq } from "./steps/01-hydrate-bq"
import { findSimilar } from "./steps/02-find-similar"
import { estimateValue } from "./steps/03-estimate-value"
import { pracaStats } from "./steps/04-praca-stats"
import { calculateTargets } from "./steps/05-calculate-targets"
import { financialAnalysis } from "./steps/06-financial-analysis"
import { generatePricingPdf } from "./steps/07-generate-pricing-pdf"
import { notifyJestor } from "./steps/08-notify-jestor"
import { notifySlackPricing } from "./steps/09-notify-slack"
import { fetchOwnerContact } from "./steps/10-fetch-owner-contact"
import { sendOwnerEmail } from "./steps/11-send-owner-email"
import { generatePitchdeck } from "./steps/12-generate-pitchdeck"
import { notifySlackPitchdeck } from "./steps/13-notify-slack-pitchdeck"
import { suggestBasket } from "./steps/14-suggest-basket"
import { suggestBaserate } from "./steps/15-suggest-baserate"
import { suggestSazonalidades } from "./steps/16-suggest-sazonalidades"
import { matchAirbnb } from "./steps/17-match-airbnb"
import type { JestorPayload, PipelineContext } from "./types"

export interface RunResult {
    ok: boolean
    onboardingId: string
    idpropriedade: string
    finalState: string
    error?: string
}

/**
 * Roda o pipeline core (F2). Idempotente: pode ser chamado várias vezes para o
 * mesmo onboardingId e cada step sobrescreve seu output.
 */
export async function runEnrichment(
    onboardingId: string,
    idpropriedade: string,
    payload: JestorPayload
): Promise<RunResult> {
    let ctx: PipelineContext = { onboardingId, idpropriedade, payload }

    try {
        await transitionState(onboardingId, idpropriedade, "em_analise")
        await logEvent(onboardingId, idpropriedade, "enrichment_started")

        // Step 1: hidratar BQ
        ctx = await hydrateBq(ctx)
        await logEvent(onboardingId, idpropriedade, "bq_hydrated", {
            found: !!ctx.bq,
            sub_grupo: ctx.bq?.sub_grupo,
        })
        await updateOnboarding(onboardingId, {
            bq_snapshot: ctx.bq as unknown as Record<string, unknown> | null,
        })

        // Step 2: imóveis similares
        ctx = await findSimilar(ctx)
        await logEvent(onboardingId, idpropriedade, "similar_found", {
            count: ctx.similar?.length || 0,
        })
        await updateOnboarding(onboardingId, {
            similar_properties: { items: ctx.similar || [] } as Record<string, unknown>,
        })

        // Step 3: Gemini → propertyValue + appreciation
        ctx = await estimateValue(ctx)
        await logEvent(onboardingId, idpropriedade, "value_estimated", ctx.estimate as unknown as Record<string, unknown>)
        await updateOnboarding(onboardingId, {
            property_value: ctx.estimate?.propertyValue ?? null,
            property_appreciation: ctx.estimate?.propertyAppreciation ?? null,
        })

        // Step 4: estatísticas da praça
        ctx = await pracaStats(ctx)
        await logEvent(onboardingId, idpropriedade, "praca_stats_loaded", {
            praca: ctx.pracaStats?.praca,
            meses: ctx.pracaStats?.detalhamento_mensal.length || 0,
        })

        // Step 5: distribuição da meta
        ctx = calculateTargets(ctx)
        await logEvent(onboardingId, idpropriedade, "targets_calculated", {
            meta_anual: ctx.metaAnual,
        })
        await updateOnboarding(onboardingId, {
            meta_anual: ctx.metaAnual ?? null,
            meta_distribuicao_mensal: { items: ctx.metaDistribuicao || [] } as Record<string, unknown>,
        })

        // Step 6: análise financeira
        ctx = financialAnalysis(ctx)
        await logEvent(onboardingId, idpropriedade, "financial_analysis_done", {
            valor_liquido_anual: ctx.analiseFinanceira?.resumo_anual.valor_liquido_anual,
            roi: ctx.analiseFinanceira?.resumo_anual.rentabilidade_total_anual_perc,
        })
        await updateOnboarding(onboardingId, {
            analise_financeira: ctx.analiseFinanceira as unknown as Record<string, unknown>,
            enriched_at: new Date().toISOString(),
        })

        // ---- F3: gera PDF do Estudo, sobe no Drive, atualiza Jestor, posta Slack ----
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

        try {
            const jestorRes = await notifyJestor(ctx, pdfResult.webViewLink)
            await logEvent(onboardingId, idpropriedade, "jestor_updated", {
                skipped: jestorRes.skipped,
                statusCode: jestorRes.statusCode,
            })
        } catch (err) {
            // Falha no Jestor não bloqueia o resto do pipeline
            await logEvent(onboardingId, idpropriedade, "jestor_update_failed", {
                error: err instanceof Error ? err.message : String(err),
            })
        }

        try {
            const slackRes = await notifySlackPricing(ctx, pdfResult.webViewLink)
            await logEvent(onboardingId, idpropriedade, "slack_pricing_posted", {
                skipped: slackRes.skipped,
                ts: slackRes.ts,
            })
        } catch (err) {
            await logEvent(onboardingId, idpropriedade, "slack_pricing_failed", {
                error: err instanceof Error ? err.message : String(err),
            })
        }

        await transitionState(onboardingId, idpropriedade, "estudo_pronto")

        // ---- F4: Apresentação ao proprietário (e-mail + Pitchdeck) ----
        let ownerContact = null as Awaited<ReturnType<typeof fetchOwnerContact>>
        try {
            ownerContact = await fetchOwnerContact(ctx)
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
            }
        } catch (err) {
            await logEvent(onboardingId, idpropriedade, "owner_contact_failed", {
                error: err instanceof Error ? err.message : String(err),
            })
        }

        if (ownerContact) {
            // Envio de e-mail (skip se sem e-mail)
            try {
                const emailRes = await sendOwnerEmail(ownerContact)
                await logEvent(onboardingId, idpropriedade, "owner_email_sent", {
                    skipped: emailRes.skipped,
                    reason: emailRes.reason,
                })
                if (!emailRes.skipped) {
                    await updateOnboarding(onboardingId, {
                        owner_email_sent_at: new Date().toISOString(),
                    })
                }
            } catch (err) {
                await logEvent(onboardingId, idpropriedade, "owner_email_failed", {
                    error: err instanceof Error ? err.message : String(err),
                })
            }

            // Geração do Pitchdeck PDF + upload Drive
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

                try {
                    const slackRes = await notifySlackPitchdeck(ownerContact, pitch.webViewLink)
                    await logEvent(onboardingId, idpropriedade, "slack_pitchdeck_posted", {
                        skipped: slackRes.skipped,
                        ts: slackRes.ts,
                    })
                } catch (err) {
                    await logEvent(onboardingId, idpropriedade, "slack_pitchdeck_failed", {
                        error: err instanceof Error ? err.message : String(err),
                    })
                }
            } catch (err) {
                await logEvent(onboardingId, idpropriedade, "pitchdeck_failed", {
                    error: err instanceof Error ? err.message : String(err),
                })
            }
        }

        await transitionState(onboardingId, idpropriedade, "apresentado")

        // ---- F6: Sugestões Price.OS (basket, baserate, sazonalidades, Airbnb) ----
        // Executadas em paralelo, tolerantes a falha individual.
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

        await transitionState(onboardingId, idpropriedade, "aguardando_aprovacao")
        await logEvent(onboardingId, idpropriedade, "enrichment_done")

        return {
            ok: true,
            onboardingId,
            idpropriedade,
            finalState: "aguardando_aprovacao",
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error("[onboarding/pipeline] runEnrichment error:", err)
        await logEvent(onboardingId, idpropriedade, "error", { message })
        return {
            ok: false,
            onboardingId,
            idpropriedade,
            finalState: "em_analise",
            error: message,
        }
    }
}

/**
 * Dispara o pipeline em background (fire-and-forget).
 * Usado pelo webhook para não bloquear a resposta 201 à Jestor.
 *
 * No Vercel, a function continua executando até maxDuration (60s default).
 * Se precisar mais que isso, migrar para `waitUntil` do @vercel/functions
 * ou para uma queue (Inngest, QStash).
 */
export function runEnrichmentInBackground(
    onboardingId: string,
    idpropriedade: string,
    payload: JestorPayload
): void {
    void runEnrichment(onboardingId, idpropriedade, payload).catch((err) => {
        console.error("[onboarding/pipeline] background error:", err)
    })
}
