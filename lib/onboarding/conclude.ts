/**
 * Ação "Concluir" (aprovacao → concluido).
 *
 * Esta é a ação que DISPARA notificações externas: atualiza Jestor, envia
 * e-mail ao proprietário, posta no Slack (Estudo + Pitchdeck) e ativa a
 * unidade (cria basket de concorrentes, libera nas Views).
 *
 * Todas as etapas são tolerantes a falha individual — uma falha no Jestor
 * não bloqueia o e-mail, e por aí vai. O state é movido para "concluido"
 * mesmo se algum dos disparos externos falhar; o operador pode reexecutar
 * via "Reprocessar" se necessário.
 */

import { getOnboarding, logEvent, transitionState, updateOnboarding } from "./repository"
import { notifyJestor } from "./steps/08-notify-jestor"
import { notifySlackPricing } from "./steps/09-notify-slack"
import { sendOwnerEmail } from "./steps/11-send-owner-email"
import { notifySlackPitchdeck } from "./steps/13-notify-slack-pitchdeck"
import { activateUnit } from "./steps/18-activate-unit"
import { invalidateOnboardingExcludeCache } from "./visibility"
import type { JestorPayload, PipelineContext } from "./types"
import type { OwnerContact } from "./steps/10-fetch-owner-contact"

export interface ConcludeInput {
    onboardingId: string
    operatorEmail: string
    /** Se true, cria competitor_basket com as sugestões aprovadas. */
    createBasket?: boolean
    /** Override do baserate se o operador editou. */
    approvedBaserate?: number | null
}

export interface ConcludeResult {
    ok: boolean
    onboardingId: string
    error?: string
    actions: {
        jestor_updated: "done" | "failed" | "skipped"
        owner_email_sent: "done" | "failed" | "skipped"
        slack_pricing_posted: "done" | "failed" | "skipped"
        slack_pitchdeck_posted: "done" | "failed" | "skipped"
        basket_created: "done" | "failed" | "skipped"
    }
    basketId?: string
}

export async function runConclusion(input: ConcludeInput): Promise<ConcludeResult> {
    const actions: ConcludeResult["actions"] = {
        jestor_updated: "skipped",
        owner_email_sent: "skipped",
        slack_pricing_posted: "skipped",
        slack_pitchdeck_posted: "skipped",
        basket_created: "skipped",
    }

    const row = await getOnboarding(input.onboardingId)
    if (!row) {
        return { ok: false, onboardingId: input.onboardingId, error: "Não encontrado", actions }
    }

    const ctx: PipelineContext = {
        onboardingId: input.onboardingId,
        idpropriedade: row.idpropriedade,
        payload: row.jestor_payload as unknown as JestorPayload,
        bq: row.bq_snapshot as unknown as PipelineContext["bq"],
    }

    // ---- 1. Atualiza Jestor com link do Estudo ----
    if (row.pdf_url) {
        try {
            const r = await notifyJestor(ctx, row.pdf_url)
            actions.jestor_updated = r.skipped ? "skipped" : "done"
            await logEvent(input.onboardingId, row.idpropriedade, "jestor_updated", {
                skipped: r.skipped,
                statusCode: r.statusCode,
            })
        } catch (err) {
            actions.jestor_updated = "failed"
            await logEvent(input.onboardingId, row.idpropriedade, "jestor_update_failed", {
                error: err instanceof Error ? err.message : String(err),
            })
        }
    }

    // ---- 2. Envia e-mail ao proprietário (skip se sem e-mail) ----
    if (row.owner_email) {
        try {
            const contact: OwnerContact = {
                idpropriedade: row.idpropriedade,
                nomePropriedade:
                    (row.bq_snapshot as { nomePropriedade?: string } | null)?.nomePropriedade ||
                    (row.jestor_payload as { propriedade?: string }).propriedade ||
                    row.idpropriedade,
                name: row.owner_name,
                telefone: row.owner_phone,
                email: row.owner_email,
            }
            const r = await sendOwnerEmail(contact)
            actions.owner_email_sent = r.skipped ? "skipped" : "done"
            await logEvent(input.onboardingId, row.idpropriedade, "owner_email_sent", {
                skipped: r.skipped,
                reason: r.reason,
            })
            if (!r.skipped) {
                await updateOnboarding(input.onboardingId, {
                    owner_email_sent_at: new Date().toISOString(),
                })
            }
        } catch (err) {
            actions.owner_email_sent = "failed"
            await logEvent(input.onboardingId, row.idpropriedade, "owner_email_failed", {
                error: err instanceof Error ? err.message : String(err),
            })
        }
    }

    // ---- 3. Posta no Slack (Estudo) ----
    if (row.pdf_url) {
        try {
            const r = await notifySlackPricing(ctx, row.pdf_url)
            actions.slack_pricing_posted = r.skipped ? "skipped" : "done"
            await logEvent(input.onboardingId, row.idpropriedade, "slack_pricing_posted", {
                skipped: r.skipped,
                ts: r.ts,
            })
        } catch (err) {
            actions.slack_pricing_posted = "failed"
            await logEvent(input.onboardingId, row.idpropriedade, "slack_pricing_failed", {
                error: err instanceof Error ? err.message : String(err),
            })
        }
    }

    // ---- 4. Posta no Slack (Pitchdeck) ----
    if (row.pitchdeck_pdf_url && row.owner_email) {
        try {
            const contact: OwnerContact = {
                idpropriedade: row.idpropriedade,
                nomePropriedade:
                    (row.bq_snapshot as { nomePropriedade?: string } | null)?.nomePropriedade ||
                    (row.jestor_payload as { propriedade?: string }).propriedade ||
                    row.idpropriedade,
                name: row.owner_name,
                telefone: row.owner_phone,
                email: row.owner_email,
            }
            const r = await notifySlackPitchdeck(contact, row.pitchdeck_pdf_url)
            actions.slack_pitchdeck_posted = r.skipped ? "skipped" : "done"
            await logEvent(input.onboardingId, row.idpropriedade, "slack_pitchdeck_posted", {
                skipped: r.skipped,
                ts: r.ts,
            })
        } catch (err) {
            actions.slack_pitchdeck_posted = "failed"
            await logEvent(input.onboardingId, row.idpropriedade, "slack_pitchdeck_failed", {
                error: err instanceof Error ? err.message : String(err),
            })
        }
    }

    // ---- 5. Ativa unidade (cria basket + libera nas Views) ----
    let basketId: string | undefined
    try {
        const r = await activateUnit({
            onboardingId: input.onboardingId,
            operatorEmail: input.operatorEmail,
            createBasket: input.createBasket ?? true,
            approvedBaserate: input.approvedBaserate ?? null,
        })
        if (r.ok) {
            actions.basket_created = r.basketId ? "done" : "skipped"
            basketId = r.basketId
        } else {
            actions.basket_created = "failed"
            await logEvent(input.onboardingId, row.idpropriedade, "activate_failed", { error: r.error })
        }
    } catch (err) {
        actions.basket_created = "failed"
        await logEvent(input.onboardingId, row.idpropriedade, "activate_failed", {
            error: err instanceof Error ? err.message : String(err),
        })
    }

    // ---- 6. Transition final ----
    await transitionState(input.onboardingId, row.idpropriedade, "concluido", {
        activated_at: new Date().toISOString(),
        operator_email: input.operatorEmail,
    })
    await logEvent(input.onboardingId, row.idpropriedade, "concluded", {
        operator: input.operatorEmail,
        actions,
    })
    invalidateOnboardingExcludeCache()

    return { ok: true, onboardingId: input.onboardingId, actions, basketId }
}
