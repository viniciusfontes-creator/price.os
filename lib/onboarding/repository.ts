/**
 * Repositório de acesso à tabela property_onboarding e events.
 * Toda operação usa service role (getSupabaseAdmin).
 */

import { getSupabaseAdmin } from "@/lib/supabase-server"
import type { OnboardingState } from "./types"

export interface OnboardingRow {
    id: string
    idpropriedade: string
    jestor_record_id: string | null
    jestor_payload: Record<string, unknown>
    state: OnboardingState

    bq_snapshot: Record<string, unknown> | null
    similar_properties: Record<string, unknown> | null
    property_value: number | null
    property_appreciation: number | null
    meta_anual: number | null
    meta_distribuicao_mensal: Record<string, unknown> | null
    analise_financeira: Record<string, unknown> | null

    pdf_url: string | null
    pdf_drive_file_id: string | null

    owner_name: string | null
    owner_email: string | null
    owner_phone: string | null
    owner_email_sent_at: string | null
    pitchdeck_pdf_url: string | null
    pitchdeck_drive_file_id: string | null
    pitchdeck_generated_at: string | null

    suggested_baserate: number | null
    suggested_basket: Record<string, unknown> | null
    suggested_sazonalidades: Record<string, unknown> | null
    matched_airbnb_listing: string | null

    approved_by: string | null
    approved_baserate: number | null
    approved_basket_id: string | null

    notes: string | null
    operator_email: string | null
    created_at: string
    enriched_at: string | null
    pdf_generated_at: string | null
    activated_at: string | null
    revisao_since: string | null
    updated_at: string
}

function db() {
    const s = getSupabaseAdmin()
    if (!s) throw new Error("Supabase admin client unavailable")
    return s
}

export async function getOnboarding(id: string): Promise<OnboardingRow | null> {
    const { data, error } = await db()
        .from("property_onboarding")
        .select("*")
        .eq("id", id)
        .maybeSingle()
    if (error) throw error
    return data as OnboardingRow | null
}

export async function getOnboardingByIdpropriedade(
    idpropriedade: string
): Promise<OnboardingRow | null> {
    const { data, error } = await db()
        .from("property_onboarding")
        .select("*")
        .eq("idpropriedade", idpropriedade)
        .maybeSingle()
    if (error) throw error
    return data as OnboardingRow | null
}

export async function updateOnboarding(
    id: string,
    fields: Partial<Omit<OnboardingRow, "id" | "created_at" | "updated_at">>
): Promise<void> {
    const { error } = await db()
        .from("property_onboarding")
        .update(fields)
        .eq("id", id)
    if (error) throw error
}

export async function transitionState(
    id: string,
    idpropriedade: string,
    newState: OnboardingState,
    extraFields: Partial<OnboardingRow> = {}
): Promise<void> {
    await updateOnboarding(id, { state: newState, ...extraFields })
    await logEvent(id, idpropriedade, "state_changed", { to: newState })
}

export async function logEvent(
    onboardingId: string,
    idpropriedade: string,
    eventType: string,
    payload?: Record<string, unknown>
): Promise<void> {
    const { error } = await db().from("property_onboarding_events").insert({
        onboarding_id: onboardingId,
        idpropriedade,
        event_type: eventType,
        payload: payload || null,
    })
    if (error) {
        // eventos são best-effort
        console.error("[onboarding/repository] logEvent error:", error)
    }
}

export async function listEvents(onboardingId: string) {
    const { data, error } = await db()
        .from("property_onboarding_events")
        .select("id, event_type, payload, created_at")
        .eq("onboarding_id", onboardingId)
        .order("created_at", { ascending: true })
    if (error) throw error
    return data || []
}
