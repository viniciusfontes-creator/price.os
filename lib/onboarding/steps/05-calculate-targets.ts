/**
 * Step 5: Distribuição da meta anual em 12 meses (v3).
 *
 * Fontes em ordem de preferência:
 *   1. Sazonalidade do Supabase (seasonality_periods da praça)
 *      → % anual por mês + N eventos por mês (cada com % do mês-pai)
 *      → Datas de eventos móveis (Carnaval, Páscoa) projetadas via rule engine
 *   2. Fallback legacy: FERIADOS hardcoded + histórico BQ (algoritmo v1)
 *
 * Mudanças do v2 pro v3:
 *   - Async (consulta Supabase)
 *   - `feriados[]` array (múltiplos eventos por mês) em vez de `feriado` único
 *   - Não aplica regras de suavização (min 5%, swap Fev/Mar, range 12-18)
 *     quando a sazonalidade Supabase é fonte — ela já é o gabarito.
 */

import { getSupabaseAdmin } from "@/lib/supabase-server"
import {
    computePeriodDates,
    type StaysPeriodRule,
} from "@/lib/stays/period-rule"
import { FERIADOS, ONBOARDING_RULES } from "../constants"
import type {
    MetaDistribuicaoMensal,
    PipelineContext,
    PracaMonthDetail,
} from "../types"

const MES_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

// ---------------------------------------------------------------------------
// Sazonalidade do Supabase
// ---------------------------------------------------------------------------

interface SazonalidadePeriod {
    seasonality_period_id: string
    name: string
    type: "month" | "event" | string
    start_date: string
    end_date: string
    percent: number
    expected_nights: number | null
    rule: StaysPeriodRule | null
}

async function loadSazonalidadePraca(praca: string | null | undefined): Promise<SazonalidadePeriod[] | null> {
    if (!praca) return null
    const supabase = getSupabaseAdmin()
    if (!supabase) return null

    const { data: pracaRow } = await supabase
        .from("seasonality_pracas")
        .select("seasonality_id")
        .eq("praca", praca)
        .maybeSingle()
    if (!pracaRow?.seasonality_id) return null

    const { data: rows, error } = await supabase
        .from("seasonality_periods")
        .select(
            "id, percent, expected_nights, stays_period, pricing_periods!inner(name, start_date, end_date, type, expected_nights)",
        )
        .eq("seasonality_id", pracaRow.seasonality_id)
    if (error || !rows?.length) return null

    return rows.map((r) => {
        const pp = (r as unknown as {
            pricing_periods: {
                name: string
                start_date: string
                end_date: string
                type: string
                expected_nights: number | null
            }
        }).pricing_periods
        const sp = (r as unknown as { stays_period: { rule?: StaysPeriodRule } | null }).stays_period
        return {
            seasonality_period_id: r.id,
            name: pp.name,
            type: pp.type,
            start_date: pp.start_date,
            end_date: pp.end_date,
            percent: Number(r.percent),
            expected_nights: r.expected_nights ?? pp.expected_nights ?? null,
            rule: sp?.rule ?? null,
        }
    })
}

// ---------------------------------------------------------------------------
// v3: Cálculo via sazonalidade do Supabase
// ---------------------------------------------------------------------------

function calculateFromSazonalidade(
    metaAnual: number,
    sazo: SazonalidadePeriod[],
    targetYear: number,
    detalhe: PracaMonthDetail[],
): MetaDistribuicaoMensal[] {
    // Separa meses e eventos
    const meses = sazo.filter((p) => p.type === "month")
    const eventos = sazo.filter((p) => p.type === "event")

    // Para cada evento, descobre o mês (projetando via rule se houver)
    interface EventoMapped extends SazonalidadePeriod {
        mes: string
        from: string
        to: string
    }
    const eventosMapped: EventoMapped[] = eventos.map((ev) => {
        const dates = ev.rule
            ? computePeriodDates(ev.rule, targetYear)
            : { from: ev.start_date, to: ev.end_date }
        // Regra: o mês do evento é o mês do END_DATE (último dia, inclusivo).
        // Ex.: Réveillon (26/12 → 02/01) → Janeiro; Finados (30/10 → 02/11) → Novembro.
        // O end_date no Supabase é inclusivo (mesmo padrão da Stays /seasons-sell).
        const endDate = new Date(dates.to + "T00:00:00Z")
        const endMonth = endDate.getUTCMonth()
        return { ...ev, mes: MES_PT[endMonth], from: dates.from, to: dates.to }
    })

    const eventosByMes = new Map<string, EventoMapped[]>()
    for (const ev of eventosMapped) {
        const arr = eventosByMes.get(ev.mes) ?? []
        arr.push(ev)
        eventosByMes.set(ev.mes, arr)
    }

    return MES_PT.map((mesNome, idx) => {
        const periodMes = meses.find((m) => {
            const m0 = new Date(m.start_date + "T00:00:00Z").getUTCMonth()
            return m0 === idx
        })

        const meta_faturamento = periodMes
            ? Number((metaAnual * (periodMes.percent / 100)).toFixed(2))
            : 0
        const meta_noites = periodMes?.expected_nights ?? 15
        const meta_diaria_media =
            meta_noites > 0 ? Number((meta_faturamento / meta_noites).toFixed(2)) : 0

        // Eventos desse mês
        const evs = eventosByMes.get(mesNome) ?? []
        const feriados = evs.map((ev) => {
            const fat = Number((meta_faturamento * (ev.percent / 100)).toFixed(2))
            const noites = ev.expected_nights ?? 3
            return {
                nome: ev.name,
                pacote_dias: Math.round(noites),
                noites_feriado: noites,
                faturamento_feriado: fat,
                diaria_media_feriado: noites > 0 ? Number((fat / noites).toFixed(2)) : 0,
                seasonality_period_id: ev.seasonality_period_id,
            }
        })

        const totalFatFeriados = feriados.reduce((s, f) => s + f.faturamento_feriado, 0)
        const totalNoitesFeriados = feriados.reduce((s, f) => s + f.noites_feriado, 0)
        const fatNormal = Number((meta_faturamento - totalFatFeriados).toFixed(2))
        const noitesNormal = Math.max(0, meta_noites - totalNoitesFeriados)

        const nao_feriado = {
            noites_nao_feriado: noitesNormal,
            faturamento_nao_feriado: fatNormal,
            diaria_media_nao_feriado:
                noitesNormal > 0 ? Number((fatNormal / noitesNormal).toFixed(2)) : 0,
            lote_1: {
                noites: Number((noitesNormal * 0.4).toFixed(2)),
                faturamento: Number((fatNormal * 0.5).toFixed(2)),
            },
            lote_2: {
                noites: Number((noitesNormal * 0.6).toFixed(2)),
                faturamento: Number((fatNormal * 0.5).toFixed(2)),
            },
        }

        // Compat: feriado (singular) = primeiro item de feriados
        const feriado = feriados[0] ?? null
        const noitesAnoPassado =
            detalhe.find((d) => d.mes === mesNome)?.total_noites ?? 0

        return {
            mes: mesNome,
            percentual_anual: ((meta_faturamento / metaAnual) * 100).toFixed(1) + "%",
            noites_ano_passado: noitesAnoPassado,
            meta_noites_2026: meta_noites,
            meta_faturamento,
            meta_diaria_media,
            feriado,
            feriados,
            nao_feriado,
        }
    })
}

// ---------------------------------------------------------------------------
// Fallback legacy: histórico BQ + FERIADOS hardcoded (algoritmo v1)
// ---------------------------------------------------------------------------

function calculateLegacy(
    metaAnual: number,
    detalhe: PracaMonthDetail[],
): MetaDistribuicaoMensal[] {
    if (detalhe.length === 0) return []

    const detalheCorr = detalhe.map((m) => ({ ...m }))
    const fev = detalheCorr.find((m) => m.mes === "Fevereiro")
    const mar = detalheCorr.find((m) => m.mes === "Março")
    let carnavalEmMarco = false
    let fevCorrFat = fev?.faturamento_total
    let marCorrFat = mar?.faturamento_total
    if (
        fev &&
        mar &&
        mar.faturamento_total > fev.faturamento_total * ONBOARDING_RULES.CARNAVAL_THRESHOLD
    ) {
        carnavalEmMarco = true
        fevCorrFat = mar.faturamento_total
        marCorrFat = fev.faturamento_total
    }

    let totalFaturamento = 0
    detalheCorr.forEach((m) => {
        if (carnavalEmMarco && m.mes === "Fevereiro") totalFaturamento += fevCorrFat || 0
        else if (carnavalEmMarco && m.mes === "Março") totalFaturamento += marCorrFat || 0
        else totalFaturamento += m.faturamento_total || 0
    })

    const PERC_MIN = ONBOARDING_RULES.PERC_MIN_MES
    const metaMin = metaAnual * PERC_MIN

    const distInicial = detalheCorr.map((item) => {
        const fatCorr =
            carnavalEmMarco && item.mes === "Fevereiro"
                ? fevCorrFat || 0
                : carnavalEmMarco && item.mes === "Março"
                  ? marCorrFat || 0
                  : item.faturamento_total || 0
        const perc = totalFaturamento > 0 ? fatCorr / totalFaturamento : 1 / 12
        return { mes: item.mes, metaInicial: metaAnual * perc }
    })

    let deficit = 0
    const abaixo: typeof distInicial = []
    const acima: typeof distInicial = []
    distInicial.forEach((it) => {
        if (it.metaInicial < metaMin) {
            deficit += metaMin - it.metaInicial
            abaixo.push(it)
        } else acima.push(it)
    })

    const metasAjustadas: Record<string, number> = {}
    abaixo.forEach((it) => (metasAjustadas[it.mes] = metaMin))
    if (acima.length > 0) {
        const totalAcima = acima.reduce((s, m) => s + m.metaInicial, 0)
        acima.forEach((it) => {
            const proporcao = it.metaInicial / totalAcima
            metasAjustadas[it.mes] = Math.max(metaMin, it.metaInicial - deficit * proporcao)
        })
    }

    if (
        metasAjustadas["Março"] != null &&
        metasAjustadas["Fevereiro"] != null &&
        metasAjustadas["Março"] > metasAjustadas["Fevereiro"]
    ) {
        const tmp = metasAjustadas["Fevereiro"]
        metasAjustadas["Fevereiro"] = metasAjustadas["Março"]
        metasAjustadas["Março"] = tmp
    }

    const noitesMensal: Record<string, number> = {}
    detalheCorr.forEach((item) => {
        const perc = item.perc_ocupacao_ano || 8.33
        let noites = Math.round((perc / 100) * ONBOARDING_RULES.DIAS_BASE_ANO)
        noites = Math.max(
            ONBOARDING_RULES.NOITES_MES.min,
            Math.min(ONBOARDING_RULES.NOITES_MES.max, noites),
        )
        noitesMensal[item.mes] = noites
    })

    if (
        metasAjustadas["Fevereiro"] > metasAjustadas["Março"] &&
        noitesMensal["Março"] > noitesMensal["Fevereiro"]
    ) {
        const tmp = noitesMensal["Fevereiro"]
        noitesMensal["Fevereiro"] = noitesMensal["Março"]
        noitesMensal["Março"] = tmp
    }

    return detalheCorr.map((item) => {
        const mes = item.mes
        const meta_faturamento = Number((metasAjustadas[mes] || 0).toFixed(2))
        const meta_noites = noitesMensal[mes] || 0
        const meta_diaria_media =
            meta_noites > 0 ? Number((meta_faturamento / meta_noites).toFixed(2)) : 0

        const cfg = FERIADOS[mes]
        const feriados: MetaDistribuicaoMensal["feriados"] = []
        let feriado: MetaDistribuicaoMensal["feriado"] = null
        let nao_feriado: MetaDistribuicaoMensal["nao_feriado"]

        if (cfg) {
            const fatFeriado = Number((meta_faturamento * cfg.perc).toFixed(2))
            const noitesFeriado = cfg.noites
            feriado = {
                nome: cfg.nome,
                pacote_dias: Math.round(cfg.noites),
                noites_feriado: noitesFeriado,
                faturamento_feriado: fatFeriado,
                diaria_media_feriado:
                    noitesFeriado > 0 ? Number((fatFeriado / noitesFeriado).toFixed(2)) : 0,
            }
            feriados.push(feriado)
            const fatNormal = Number((meta_faturamento - fatFeriado).toFixed(2))
            const noitesNormal = Math.max(0, meta_noites - noitesFeriado)
            nao_feriado = {
                noites_nao_feriado: noitesNormal,
                faturamento_nao_feriado: fatNormal,
                diaria_media_nao_feriado:
                    noitesNormal > 0 ? Number((fatNormal / noitesNormal).toFixed(2)) : 0,
                lote_1: {
                    noites: Number((noitesNormal * 0.4).toFixed(2)),
                    faturamento: Number((fatNormal * 0.5).toFixed(2)),
                },
                lote_2: {
                    noites: Number((noitesNormal * 0.6).toFixed(2)),
                    faturamento: Number((fatNormal * 0.5).toFixed(2)),
                },
            }
        } else {
            nao_feriado = {
                noites_nao_feriado: meta_noites,
                faturamento_nao_feriado: meta_faturamento,
                diaria_media_nao_feriado: meta_diaria_media,
                lote_1: {
                    noites: Number((meta_noites * 0.4).toFixed(2)),
                    faturamento: Number((meta_faturamento * 0.5).toFixed(2)),
                },
                lote_2: {
                    noites: Number((meta_noites * 0.6).toFixed(2)),
                    faturamento: Number((meta_faturamento * 0.5).toFixed(2)),
                },
            }
        }

        return {
            mes,
            percentual_anual: ((meta_faturamento / metaAnual) * 100).toFixed(1) + "%",
            noites_ano_passado: item.total_noites,
            meta_noites_2026: meta_noites,
            meta_faturamento,
            meta_diaria_media,
            feriado,
            feriados,
            nao_feriado,
        }
    })
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function calculateTargets(ctx: PipelineContext): Promise<PipelineContext> {
    const propertyValue = ctx.estimate?.propertyValue ?? 0
    const metaAnual = Number((propertyValue * ONBOARDING_RULES.META_ANUAL_PERC).toFixed(2))

    if (!metaAnual) {
        return { ...ctx, metaAnual, metaDistribuicao: [] }
    }

    const detalhe = ctx.pracaStats?.detalhamento_mensal || []
    const praca = ctx.bq?.praca ?? null

    // Tenta sazonalidade do Supabase
    const sazo = await loadSazonalidadePraca(praca)
    if (sazo && sazo.length > 0) {
        const targetYear = new Date().getUTCFullYear()
        const distribuicao = calculateFromSazonalidade(metaAnual, sazo, targetYear, detalhe)
        return { ...ctx, metaAnual, metaDistribuicao: distribuicao }
    }

    // Fallback: histórico BQ
    const distribuicao = calculateLegacy(metaAnual, detalhe)
    return { ...ctx, metaAnual, metaDistribuicao: distribuicao }
}
