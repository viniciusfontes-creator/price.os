/**
 * Gating de dry-run para escritas na Stays.
 *
 * Cada escopo de escrita (pricing, onboarding, metas, calendar) tem sua
 * própria env. Quando ON, o caller faz tudo localmente mas pula o PATCH/POST
 * real na Stays. Default: ON fora de produção.
 *
 * Padrão idêntico a `isDryRun()` em lib/onboarding/constants.ts — este
 * helper generaliza para os outros escopos sem mexer no onboarding existente.
 */

export type StaysApplyScope = "pricing" | "onboarding" | "metas" | "calendar"

const ENV_BY_SCOPE: Record<StaysApplyScope, string> = {
    pricing: "PRICING_APPLY_DRY_RUN",
    onboarding: "ONBOARDING_DRY_RUN",
    metas: "METAS_APPLY_DRY_RUN",
    calendar: "CALENDAR_APPLY_DRY_RUN",
}

export function isStaysApplyDryRun(scope: StaysApplyScope): boolean {
    const flag = process.env[ENV_BY_SCOPE[scope]]
    if (flag != null) return flag === "true" || flag === "1"
    return process.env.NODE_ENV !== "production"
}

/** Atalho para o escopo de aprovação de ajustes (`/sugestoes-estagiario/precificacao`). */
export function isPricingApplyDryRun(): boolean {
    return isStaysApplyDryRun("pricing")
}
