/**
 * Step 16: Sugere a Seasonality padrão da praça da unidade.
 *
 * Procura em seasonality_pracas a sazonalidade vinculada à praça e retorna
 * o conjunto de períodos (seasonality_periods) com seus percentuais.
 */

import { getSupabaseAdmin } from "@/lib/supabase-server"
import type { PipelineContext } from "../types"

export interface SazonalidadeSuggestion {
    seasonality_id: string
    seasonality_name: string | null
    praca: string
    periods: Array<{
        id: string
        period_id: string
        percent: number | null
        expected_nights: number | null
    }>
}

export async function suggestSazonalidades(
    ctx: PipelineContext
): Promise<SazonalidadeSuggestion | null> {
    const supabase = getSupabaseAdmin()
    if (!supabase) return null

    const praca = ctx.payload.localidade || ctx.bq?.praca
    if (!praca) return null

    const { data: pracaRow, error: pErr } = await supabase
        .from("seasonality_pracas")
        .select("seasonality_id, praca")
        .eq("praca", praca)
        .maybeSingle()

    if (pErr || !pracaRow) return null

    const { data: season } = await supabase
        .from("seasonalities")
        .select("id, name")
        .eq("id", pracaRow.seasonality_id)
        .maybeSingle()

    const { data: periods } = await supabase
        .from("seasonality_periods")
        .select("id, period_id, percent, expected_nights")
        .eq("seasonality_id", pracaRow.seasonality_id)
        .order("period_id", { ascending: true })

    return {
        seasonality_id: pracaRow.seasonality_id,
        seasonality_name: season?.name || null,
        praca,
        periods: (periods || []).map((p) => ({
            id: p.id as string,
            period_id: p.period_id as string,
            percent: p.percent as number | null,
            expected_nights: p.expected_nights as number | null,
        })),
    }
}
