/**
 * Rule engine para projetar datas de periods em qualquer ano.
 *
 * Suporta 3 tipos:
 *   - month_full      → mês inteiro (01 do mês a 01 do próximo)
 *   - fixed           → data fixa, opcionalmente cruzando ano (Réveillon)
 *   - easter_offset   → offset em dias da Páscoa Católica (Carnaval, Semana Santa)
 *
 * Páscoa é calculada via algoritmo de Gauss/Meeus (Computus Católico).
 */

export type StaysPeriodKind = "month_full" | "fixed" | "easter_offset"

export interface MonthFullRule {
    kind: "month_full"
    month: number // 1-12
}

export interface FixedRule {
    kind: "fixed"
    /** Mês de início (1-12). Se a duração levar a passar do dia 31, vai pro mês seguinte. */
    month_start: number
    /** Dia de início (1-31). */
    day_start: number
    /** Duração em dias (incluso). `to` será `from + duration_days`. */
    duration_days: number
}

export interface EasterOffsetRule {
    kind: "easter_offset"
    /** Dias antes (negativo) ou depois da Páscoa. Carnaval = -47, Sex Santa = -2. */
    offset_days: number
    duration_days: number
}

export type StaysPeriodRule = MonthFullRule | FixedRule | EasterOffsetRule

export interface ComputedDates {
    from: string // YYYY-MM-DD
    to: string // YYYY-MM-DD (exclusive — Stays convention)
}

// ---------------------------------------------------------------------------
// Páscoa Católica (algoritmo de Meeus/Jones/Butcher)
// ---------------------------------------------------------------------------

export function easterDate(year: number): Date {
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31)
    const day = ((h + l - 7 * m + 114) % 31) + 1
    return new Date(Date.UTC(year, month - 1, day))
}

// ---------------------------------------------------------------------------
// Helpers de data
// ---------------------------------------------------------------------------

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
    const c = new Date(d)
    c.setUTCDate(c.getUTCDate() + n)
    return c
}

// ---------------------------------------------------------------------------
// Computa as datas para um ano específico
// ---------------------------------------------------------------------------

export function computePeriodDates(rule: StaysPeriodRule, year: number): ComputedDates {
    if (rule.kind === "month_full") {
        const from = new Date(Date.UTC(year, rule.month - 1, 1))
        const to = new Date(Date.UTC(year, rule.month, 1)) // 1º do próximo mês
        return { from: isoDate(from), to: isoDate(to) }
    }

    if (rule.kind === "fixed") {
        const from = new Date(Date.UTC(year, rule.month_start - 1, rule.day_start))
        const to = addDays(from, rule.duration_days)
        return { from: isoDate(from), to: isoDate(to) }
    }

    // easter_offset
    const easter = easterDate(year)
    const from = addDays(easter, rule.offset_days)
    const to = addDays(from, rule.duration_days)
    return { from: isoDate(from), to: isoDate(to) }
}

// ---------------------------------------------------------------------------
// Inferência reversa: a partir de from/to + nome, propõe uma rule
// ---------------------------------------------------------------------------

/**
 * Tenta inferir uma rule a partir das datas atuais + nome do period.
 * Heurística — operador deve revisar.
 */
export function inferRule(name: string, from: string, to: string): StaysPeriodRule | null {
    const fromD = new Date(from + "T00:00:00Z")
    const toD = new Date(to + "T00:00:00Z")
    const durationDays = Math.round((toD.getTime() - fromD.getTime()) / 86400000)
    const fromYear = fromD.getUTCFullYear()
    const fromMonth = fromD.getUTCMonth() + 1
    const fromDay = fromD.getUTCDate()

    // Mês cheio: começa no dia 1 e dura ~30 dias
    if (fromDay === 1 && durationDays >= 27 && durationDays <= 32) {
        return { kind: "month_full", month: fromMonth }
    }

    // Easter-related — APENAS quando o NOME sugere que move com Páscoa.
    // Tiradentes/Finados/Consciência Negra são fixos mesmo perto da Páscoa.
    const easter = easterDate(fromYear)
    const offsetFromEaster = Math.round((fromD.getTime() - easter.getTime()) / 86400000)
    const nameLc = name.toLowerCase()
    const isEasterMovable =
        (nameLc.includes("carnaval") && offsetFromEaster >= -55 && offsetFromEaster <= -40) ||
        (nameLc.match(/santa|p[áa]scoa/) && offsetFromEaster >= -10 && offsetFromEaster <= 5) ||
        (nameLc.includes("corpus") && offsetFromEaster >= 55 && offsetFromEaster <= 65)
    if (isEasterMovable) {
        return {
            kind: "easter_offset",
            offset_days: offsetFromEaster,
            duration_days: durationDays,
        }
    }

    // Default: fixed
    return {
        kind: "fixed",
        month_start: fromMonth,
        day_start: fromDay,
        duration_days: durationDays,
    }
}
