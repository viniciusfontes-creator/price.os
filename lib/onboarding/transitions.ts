/**
 * Matriz de transições válidas no Kanban de Onboarding.
 *
 * Estados:
 *   fila              — Aguardando processamento (manual ou auto). Webhook
 *                       acabou de chegar; operador pode segurar antes de
 *                       gastar Gemini/PDF.
 *   processamento_ia  — Pipeline rodando (BQ + Gemini + cálculos + PDFs +
 *                       Drive + Jestor). Estado transient (~30-60s). NÃO
 *                       envia email/Slack ainda.
 *   revisao           — Pipeline terminou. RM/Pricing revisa por até 48h.
 *                       Pode editar dados e regerar PDFs.
 *   aprovacao         — Vitor (líder) aprova ou solicita alterações.
 *                       Auto-promovida da Revisão após 48h via cron.
 *   concluido         — Ativação confirmada. DISPARA: email proprietário,
 *                       Slack notification, criação de basket.
 *                       Unidade passa a aparecer nas Views.
 *   arquivada         — Descartada pelo operador. Terminal.
 *
 * Transições manuais (drag-and-drop):
 *
 *   fila              → processamento_ia   ✓ (operador força)
 *   fila              → arquivada          ✓
 *   processamento_ia  → arquivada          ✓ (cancela)
 *   revisao           → aprovacao          ✓ (antecipa do cron)
 *   revisao           → arquivada          ✓
 *   aprovacao         → concluido          ✓ (Vitor aprova)
 *   aprovacao         → revisao            ✓ (Vitor solicita alterações)
 *   aprovacao         → arquivada          ✓
 *
 * Transições automáticas (pelo sistema, não drag):
 *
 *   processamento_ia  → revisao   (pipeline termina)
 *   revisao           → aprovacao (cron diário, após 48h em revisao)
 *
 * Bloqueadas:
 *
 *   * → fila                       (estado inicial, só inserção)
 *   * → processamento_ia (manual)  só de fila; nunca volta pra cá
 *   concluido → *                  terminal
 *   arquivada → *                  terminal (operador pode desarquivar via
 *                                   suporte, mas não no UI)
 */

import type { OnboardingState } from "./types"

export interface TransitionRule {
    /** Origem (state atual). */
    from: OnboardingState
    /** Destinos permitidos via drag manual. */
    manual: OnboardingState[]
    /** Destinos permitidos automaticamente (pipeline / cron). */
    auto: OnboardingState[]
    /** Notas para a UI exibir tooltip ao bloquear. */
    notes?: Partial<Record<OnboardingState, string>>
}

export const TRANSITIONS: Record<OnboardingState, TransitionRule> = {
    fila: {
        from: "fila",
        manual: ["processamento_ia", "arquivada"],
        auto: ["processamento_ia"],
    },
    processamento_ia: {
        from: "processamento_ia",
        manual: ["arquivada"],
        auto: ["revisao"],
        notes: {
            revisao: "Aguarde o pipeline terminar antes de avançar manualmente",
        },
    },
    revisao: {
        from: "revisao",
        manual: ["aprovacao", "arquivada"],
        auto: ["aprovacao"],
        notes: {
            concluido: "Passa antes pela coluna de Aprovação (Vitor decide)",
        },
    },
    aprovacao: {
        from: "aprovacao",
        manual: ["concluido", "revisao", "arquivada"],
        auto: [],
        notes: {
            revisao: "Use quando solicitar alterações ao operador",
        },
    },
    concluido: {
        from: "concluido",
        manual: [],
        auto: [],
        notes: {
            revisao: "Concluído é estado terminal — não pode voltar",
            arquivada: "Concluído é estado terminal — não pode voltar",
        },
    },
    arquivada: {
        from: "arquivada",
        manual: [],
        auto: [],
    },
}

export function canTransitionManually(
    from: OnboardingState,
    to: OnboardingState
): boolean {
    return TRANSITIONS[from]?.manual.includes(to) ?? false
}

export function transitionReason(
    from: OnboardingState,
    to: OnboardingState
): string | null {
    return TRANSITIONS[from]?.notes?.[to] ?? null
}
