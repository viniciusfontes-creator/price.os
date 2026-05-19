/**
 * Types compartilhados do pipeline de Onboarding.
 */

export type OnboardingState =
    | "fila"
    | "processamento_ia"
    | "revisao"
    | "aprovacao"
    | "concluido"
    | "arquivada"

export interface JestorPayload {
    recordid?: string | number
    idpropriedade?: string
    propriedade?: string
    rotulo?: string
    proprietario?: string
    quartos?: string | number
    latitude?: string | number
    longitude?: string | number
    localidade?: string
}

/**
 * Snapshot do BQ W1 (warehouse.propriedades_subgrupos) — preenche os
 * campos que a Jestor pode não ter mandado.
 */
export interface BqHydratedProperty {
    idpropriedade: string
    nomepropriedade: string | null
    nome_externo: string | null
    grupo_nome: string | null
    praca: string | null
    sub_grupo: string | null
    empreendimento_pousada: string | null
    cidade: string | null
    estado: string | null
    latitude: number | null
    longitude: number | null
    _i_maxguests: number | null
    _i_rooms: number | null
    pricemaster: number | null
    status_aparente: string | null
    staysid_proprietario: string | null
}

/** Saída do RPC buscar_imoveis_semelhantes (cada linha = imóvel comparável). */
export interface SimilarProperty {
    valor_imovel: number | null
    metros_quadrados: number | null
    quartos: number | null
    valorizacao_percentual: number | null
    monthlyDailyRate?: Record<string, number>
    monthlyOccupancy?: Record<string, number>
    [key: string]: unknown
}

/** Resultado do Gemini Flash Lite (estimativa de valor + valorização). */
export interface ValueEstimate {
    propertyValue: number
    propertyAppreciation: number
}

/** Linha de detalhamento mensal vinda da praça (BQ stats). */
export interface PracaMonthDetail {
    mes: string
    total_propriedades: number
    total_reservas: number
    faturamento_total: number
    total_noites: number
    perc_faturamento_ano: number
    perc_ocupacao_ano: number
}

export interface PracaStats {
    praca: string
    total_propriedades_ano: number
    total_reservas_ano: number
    faturamento_total_ano: number
    total_noites_ano: number
    detalhamento_mensal: PracaMonthDetail[]
}

/** Saída do step calculate-targets. */
export interface MetaDistribuicaoMensal {
    mes: string
    percentual_anual: string
    noites_ano_passado: number
    meta_noites_2026: number
    meta_faturamento: number
    meta_diaria_media: number
    /** @deprecated Use `feriados` (array). Mantido pra retrocompat: primeiro item de `feriados`. */
    feriado: {
        nome: string
        pacote_dias: number
        noites_feriado: number
        faturamento_feriado: number
        diaria_media_feriado: number
    } | null
    /** Todos os eventos do mês (sazonalidade do Supabase). Vazio se praça sem sazonalidade. */
    feriados: Array<{
        nome: string
        pacote_dias: number
        noites_feriado: number
        faturamento_feriado: number
        diaria_media_feriado: number
        /** Quando vem da sazonalidade Supabase, identificador do period. */
        seasonality_period_id?: string
        /** Datas reais projetadas do evento (após nextOccurrence). YYYY-MM-DD. */
        from?: string
        to?: string
    }>
    nao_feriado: {
        noites_nao_feriado: number
        faturamento_nao_feriado: number
        diaria_media_nao_feriado: number
        lote_1: { noites: number; faturamento: number }
        lote_2: { noites: number; faturamento: number }
    }
}

/** Saída do step financial-analysis. */
export interface ValorLiquidoMensal {
    mes: string
    faturamento_bruto: number
    noites: number
    comissao_qav: number
    custo_fixo: number
    custo_variavel: number
    receita_liquida: number
    custo_total: number
    valor_liquido: number
    noites_breakeven: number | null
    atingiu_breakeven: boolean
}

export interface AnaliseFinanceira {
    parametros: {
        valor_imovel: number
        comissao_qav_perc: string
        custo_fixo_anual_perc: string
        custo_fixo_anual: number
        custo_fixo_mensal: number
        custo_variavel_por_quarto_noite: number
        quartos: number
    }
    valor_liquido_mensal: ValorLiquidoMensal[]
    resumo_anual: {
        faturamento_bruto_anual: number
        comissao_qav_anual: number
        receita_liquida_anual: number
        custo_total_anual: number
        custo_fixo_anual: number
        custo_variavel_anual: number
        valor_liquido_anual: number
        rentabilidade_operacional_perc: string
        valorizacao_anual_perc: string
        rentabilidade_total_anual_perc: string
    }
}

/**
 * Contexto que atravessa todos os steps do pipeline. Imutável entre steps;
 * cada step retorna o mesmo objeto enriquecido.
 */
export interface PipelineContext {
    onboardingId: string
    idpropriedade: string
    payload: JestorPayload

    // preenchidos pelos steps
    bq?: BqHydratedProperty | null
    similar?: SimilarProperty[]
    estimate?: ValueEstimate
    pracaStats?: PracaStats | null
    metaAnual?: number
    metaDistribuicao?: MetaDistribuicaoMensal[]
    analiseFinanceira?: AnaliseFinanceira
}
