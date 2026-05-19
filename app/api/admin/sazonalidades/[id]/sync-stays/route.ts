/**
 * GET  /api/admin/sazonalidades/:id/sync-stays
 *      Propõe matching entre seasonality_periods (Price.OS) e season templates (Stays).
 *
 * PUT  /api/admin/sazonalidades/:id/sync-stays
 *      Persiste matchings aprovados em seasonality_periods.stays_period.
 *
 * Algoritmo de match (GET):
 *   1. Lê stays_region_id da sazonalidade
 *   2. GET /parr/seasons-sell?_idregion=X — pega templates atuais
 *   3. Para cada seasonality_period do Price.OS, encontra o template Stays
 *      mais próximo por (mês de start) + (nome similar) + (duração)
 *   4. Para o template casado, infere uma rule via inferRule()
 *   5. Devolve { matches: [...], stays_only: [...], price_only: [...] }
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { requireAdminSession } from "@/lib/stays/admin-auth"
import { listSeasonTemplates, type SeasonTemplate } from "@/lib/stays/pricing"
import { inferRule, type StaysPeriodRule } from "@/lib/stays/period-rule"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface PriceOSPeriod {
    id: string
    name: string
    start_date: string
    end_date: string
    type: string
}

interface MatchProposal {
    price_os_period: PriceOSPeriod
    stays_template: SeasonTemplate | null
    confidence: "high" | "medium" | "low" | "none"
    proposed_rule: StaysPeriodRule | null
    current_mapping?: {
        stays_template_id?: string
        rule?: StaysPeriodRule
    } | null
}

interface SyncResponse {
    seasonality: { id: string; name: string; stays_region_id: string | null }
    matches: MatchProposal[]
    stays_only: SeasonTemplate[]
    summary: { matched: number; price_only: number; stays_only: number }
}

// ---------------------------------------------------------------------------
// Match score: 0-100. Maior = melhor match.
// ---------------------------------------------------------------------------

function normalizeName(s: string): string {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
}

function nameScore(a: string, b: string): number {
    const an = normalizeName(a)
    const bn = normalizeName(b)
    if (an === bn) return 100
    if (an.includes(bn) || bn.includes(an)) return 75
    const aTokens = new Set(an.split(" "))
    const bTokens = new Set(bn.split(" "))
    const intersect = [...aTokens].filter((t) => bTokens.has(t))
    if (intersect.length === 0) return 0
    return (intersect.length / Math.max(aTokens.size, bTokens.size)) * 60
}

function monthScore(price: string, stays: string): number {
    const m1 = new Date(price + "T00:00:00Z").getUTCMonth()
    const m2 = new Date(stays + "T00:00:00Z").getUTCMonth()
    if (m1 === m2) return 30
    if (Math.abs(m1 - m2) === 1 || Math.abs(m1 - m2) === 11) return 10
    return 0
}

function matchScore(period: PriceOSPeriod, template: SeasonTemplate): number {
    return nameScore(period.name, template.name) + monthScore(period.start_date, template.from)
}

function pickBest(
    period: PriceOSPeriod,
    templates: SeasonTemplate[],
): { template: SeasonTemplate | null; confidence: "high" | "medium" | "low" | "none" } {
    let best: { template: SeasonTemplate; score: number } | null = null
    for (const t of templates) {
        if (t.status !== "active") continue
        const score = matchScore(period, t)
        if (!best || score > best.score) best = { template: t, score }
    }
    if (!best || best.score === 0) return { template: null, confidence: "none" }
    if (best.score >= 100) return { template: best.template, confidence: "high" }
    if (best.score >= 70) return { template: best.template, confidence: "medium" }
    return { template: best.template, confidence: "low" }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })

    const { data: seasonality, error: e1 } = await supabase
        .from("seasonalities")
        .select("id, name, stays_region_id")
        .eq("id", params.id)
        .single()
    if (e1 || !seasonality) {
        return NextResponse.json({ error: "Sazonalidade não encontrada" }, { status: 404 })
    }
    if (!seasonality.stays_region_id) {
        return NextResponse.json(
            { error: "Sazonalidade sem region vinculada — configure primeiro em /system/sazonalidades" },
            { status: 422 },
        )
    }

    // Periods do Price.OS
    const { data: periods, error: e2 } = await supabase
        .from("seasonality_periods")
        .select("id, period_id, stays_period, pricing_periods!inner(name, start_date, end_date, type)")
        .eq("seasonality_id", params.id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    const priceOSPeriods: Array<PriceOSPeriod & { sp_id: string; stays_period: unknown }> = []
    for (const p of periods ?? []) {
        const pp = (p as unknown as { pricing_periods: { name: string; start_date: string; end_date: string; type: string } }).pricing_periods
        priceOSPeriods.push({
            sp_id: p.id,
            id: p.period_id,
            name: pp.name,
            start_date: pp.start_date,
            end_date: pp.end_date,
            type: pp.type,
            stays_period: p.stays_period,
        })
    }

    // Templates da region
    let templates: SeasonTemplate[] = []
    try {
        templates = await listSeasonTemplates(seasonality.stays_region_id)
    } catch (e) {
        return NextResponse.json(
            { error: `Falha ao buscar templates Stays: ${(e as Error).message}` },
            { status: 502 },
        )
    }

    const activeTemplates = templates.filter((t) => t.status === "active")
    const usedTemplateIds = new Set<string>()
    const matches: MatchProposal[] = []

    for (const period of priceOSPeriods) {
        const { template, confidence } = pickBest(period, activeTemplates)
        let rule: StaysPeriodRule | null = null
        if (template) {
            rule = inferRule(period.name, template.from, template.to)
            usedTemplateIds.add(template._id)
        }
        matches.push({
            price_os_period: {
                id: period.id,
                name: period.name,
                start_date: period.start_date,
                end_date: period.end_date,
                type: period.type,
            },
            stays_template: template,
            confidence,
            proposed_rule: rule,
            current_mapping: period.stays_period as MatchProposal["current_mapping"],
        })
    }

    const stays_only = activeTemplates.filter((t) => !usedTemplateIds.has(t._id))

    const response: SyncResponse = {
        seasonality: {
            id: seasonality.id,
            name: seasonality.name,
            stays_region_id: seasonality.stays_region_id,
        },
        matches,
        stays_only,
        summary: {
            matched: matches.filter((m) => m.stays_template).length,
            price_only: matches.filter((m) => !m.stays_template).length,
            stays_only: stays_only.length,
        },
    }
    return NextResponse.json(response)
}

// ---------------------------------------------------------------------------
// PUT handler — persiste matchings aprovados
// ---------------------------------------------------------------------------

interface PutPayload {
    mappings: Array<{
        seasonality_period_sp_id: string
        stays_template_id: string | null
        rule: StaysPeriodRule | null
        current: { from: string; to: string } | null
    }>
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })

    let body: PutPayload
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 })
    }
    if (!Array.isArray(body.mappings)) {
        return NextResponse.json({ error: "Campo 'mappings' obrigatório" }, { status: 400 })
    }

    let updated = 0
    for (const m of body.mappings) {
        const payload =
            m.stays_template_id && m.current
                ? {
                      stays_period: {
                          current: { ...m.current, stays_template_id: m.stays_template_id },
                          rule: m.rule,
                          last_synced_at: new Date().toISOString(),
                      },
                  }
                : { stays_period: null }
        const { error } = await supabase
            .from("seasonality_periods")
            .update(payload)
            .eq("id", m.seasonality_period_sp_id)
            .eq("seasonality_id", params.id)
        if (!error) updated += 1
    }

    return NextResponse.json({ success: true, updated, total: body.mappings.length })
}
