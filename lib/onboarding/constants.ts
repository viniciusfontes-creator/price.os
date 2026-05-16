/**
 * Regras de negócio do Onboarding (porte das constantes do workflow n8n
 * [Onboarding] Precificação e Estudo de Rentabilidade).
 */

export const ONBOARDING_RULES = {
    COMISSAO_QAV: 0.20,                       // 20%
    CUSTO_FIXO_ANUAL_PERC: 0.03,              // 3% do valor do imóvel
    CUSTO_VARIAVEL_QUARTO_NOITE: 25,          // R$ 25 (50% energia / 30% limpeza / 20% manut)
    META_ANUAL_PERC: 0.14,                    // 14% do valor do imóvel
    PERC_MIN_MES: 0.05,                       // mínimo 5% por mês
    DIAS_BASE_ANO: 216,
    NOITES_MES: { min: 12, max: 18 },
    CARNAVAL_THRESHOLD: 1.3,                  // se Mar > Fev × 1.3, swap
    RAIO_BUSCA_SIMILARES_KM: 5,
    AREA_PADRAO_M2: 80,                       // fallback quando RPC exige p_area e payload Jestor não traz
} as const

export const FERIADOS: Record<
    string,
    { nome: string; perc: number; noites: number }
> = {
    Janeiro: { nome: "Reveillon", perc: 0.54, noites: 4 },
    Fevereiro: { nome: "Carnaval", perc: 0.50, noites: 3 },
    Abril: { nome: "Semana Santa", perc: 0.50, noites: 3 },
    Maio: { nome: "Dia do Trabalho", perc: 0.34, noites: 3 },
    Junho: { nome: "Corpus Christi", perc: 0.34, noites: 3 },
    Setembro: { nome: "7 de Setembro", perc: 0.34, noites: 3 },
    Outubro: { nome: "Crianças/Finados", perc: 0.34, noites: 3.5 },
    Novembro: { nome: "Consciência Negra", perc: 0.34, noites: 3 },
}

/**
 * Mapeamento de praça → folder do Drive de "Estudos de Rentabilidade".
 * Replica os IDs do Switch do workflow n8n.
 */
export const DRIVE_FOLDERS_BY_PRACA: Record<string, string> = {
    "Pipa": "1vsHNhyEqZGGhml1plrYgi8k43jZFabiE",
    "Milagres": "1LFB_54qF88rOjCrAJvdZPmY8uiCSRbp0",
    "São Miguel dos Milagres": "1LFB_54qF88rOjCrAJvdZPmY8uiCSRbp0",
    "Maceió": "1Iq3HbAXUErpcKF6iYc3sGFHAjbTLET_6",
    "Japaratinga": "1PViIPqWzdV3gqS76BE8OUXP__FAtaQFB",
    "João Pessoa": "1DFcx2YyLgLtiHEg_uqqkmFMJupRm18d_",
    "Bananeiras": "17v6SsCJZ5vOqYJen0FsEvMjFzUP59rnp",
    "Natal e Litoral Sul": "1xUlVE_lYksiRvNBP4VugDXAEn26gu7sh",
    "Litoral Norte": "1fAsWQ-ifej0oznEqgLKXzNwiB9PNgo0b",
    "São Miguel do Gostoso": "1uMKh9EDYInTbfbt3h0dhxO8WXqIbD0NV",
}

/** Pasta única para Pitchdecks ao proprietário (sub-workflow [Owner] Apresentação). */
export const DRIVE_FOLDER_PITCHDECKS = "1ol6MJ3ZOSqaHpMq61g68bUbsEaGu-Twg"

/** Canal Slack #onboarding-precificação (ID do workflow n8n). */
export const SLACK_CHANNEL_ONBOARDING = "C08G9NL3T55"

/**
 * Dry-run mode: quando ON, NÃO envia e-mail ao proprietário, NÃO escreve
 * no Drive, NÃO atualiza Jestor e NÃO posta no Slack. Apenas loga e grava
 * artefatos localmente. Default: ON em dev/test, OFF em prod.
 */
export function isDryRun(): boolean {
    const flag = process.env.ONBOARDING_DRY_RUN
    if (flag != null) return flag === "true" || flag === "1"
    // Default: dry-run ligado fora de produção
    return process.env.NODE_ENV !== "production"
}
