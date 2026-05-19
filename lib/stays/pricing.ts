/**
 * Helpers tipados para os endpoints /external/v1/parr/ da Stays.
 *
 * Modelo conceitual (verificado empiricamente em 2026-05-18 com tenant
 * beto.stays.com.br):
 *
 *   PRICE-REGION = "Regras de preço" no PMS (catálogo).
 *   Define a estrutura de PERÍODOS, EVENTOS, DOW e ladder multi-LOS.
 *   Existem hoje 16 regions ativas. Geridas só na UI Stays.
 *
 *   SEASON = instância materializada para 1 listing × 1 período da region.
 *   Tem _idseason único. Carrega baseRateValue + ratePlans (multi-LOS).
 *
 *   PRICEMASTER = padrão "pai/filho" da Stays. Várias unidades-filhas podem
 *   compartilhar o mesmo _id da listing-mãe (Pricemaster_ID no warehouse BQ).
 *   PATCH no _id-mãe propaga para todas as filhas automaticamente.
 */

import { staysFetch, StaysApiError } from "./client"
import { staysJsonRpc, StaysSessionError } from "./session-client"

// ============================================================================
// Types
// ============================================================================

export interface PriceRegion {
    _id: string
    name: string
}

export interface RatePlan {
    minStay: number
    _i_percent: number
    _f_val?: number
}

export interface MonthlyRate {
    minStay: number
    _f_val: number
}

export interface ListingSeason {
    _idlisting: string
    _idseason: string
    type: "global" | "individual"
    status: "active" | "inactive"
    from: string // YYYY-MM-DD
    to: string // YYYY-MM-DD
    baseRateValue: number
    ratePlans: RatePlan[]
    monthlyRate?: MonthlyRate
}

export interface SeasonPatch {
    type: "global" | "individual"
    baseRateValue: number
    monthlyRateValue?: number
    /** Apenas em type='individual': override de % por minStay. */
    ratePlans?: Array<{ minStay: number; _i_percent: number }>
}

// ============================================================================
// Region (GET / POST)
// ============================================================================

/** GET /parr/price-regions — lista regions ativas no PMS. */
export async function listPriceRegions(): Promise<PriceRegion[]> {
    const data = await staysFetch<PriceRegion[]>("/external/v1/parr/price-regions")
    return data
}

/** POST /parr/price-regions — cria nova region. Em geral usada na UI Stays. */
export async function createPriceRegion(name: string): Promise<PriceRegion> {
    return staysFetch<PriceRegion>("/external/v1/parr/price-regions", {
        method: "POST",
        body: { name },
    })
}

// ============================================================================
// Seasons da listing (GET / PATCH)
// ============================================================================

/**
 * GET /parr/listing-rates-sell — lista todas seasons da listing no range.
 * Requer from/to em ISO YYYY-MM-DD. Retorna ordenado por from asc.
 *
 * Cobre 365 dias = quantidade típica de 25-35 seasons (varia por region).
 */
export async function listListingSeasons(params: {
    listingId: string
    from: string
    to: string
}): Promise<ListingSeason[]> {
    return staysFetch<ListingSeason[]>(
        `/external/v1/parr/listing-rates-sell?listingId=${encodeURIComponent(params.listingId)}&from=${params.from}&to=${params.to}`,
    )
}

/** GET /parr/listing-rates-sell/{seasonId} — detalhe de uma season. */
export async function getListingSeason(params: {
    listingId: string
    seasonId: string
}): Promise<ListingSeason> {
    return staysFetch<ListingSeason>(
        `/external/v1/parr/listing-rates-sell/${encodeURIComponent(params.seasonId)}?listingId=${encodeURIComponent(params.listingId)}`,
    )
}

/**
 * PATCH /parr/listing-rates-sell/{seasonId} — atualiza preço de uma season.
 *
 * Modo "global" (recomendado): só envia baseRateValue, ladder vem da region.
 * Modo "individual": redefine ratePlans com _i_percent próprios.
 *
 * Algumas seasons (Mensalista) exigem monthlyRateValue — se não enviado,
 * a Stays retorna 400 "Monthly rate is required". Quem chama deve tratar.
 */
export async function patchListingSeason(params: {
    listingId: string
    seasonId: string
    body: SeasonPatch
}): Promise<ListingSeason> {
    return staysFetch<ListingSeason>(
        `/external/v1/parr/listing-rates-sell/${encodeURIComponent(params.seasonId)}?listingId=${encodeURIComponent(params.listingId)}`,
        { method: "PATCH", body: params.body },
    )
}

// ============================================================================
// Season Templates (periods configurados na Region — globais)
// ============================================================================
//
// Distinção crítica:
//   - SEASON TEMPLATE = period configurado na Region (vive em /parr/seasons-sell).
//     Tem `_idregion`. Cada Region tem N templates (Junho 2026, Réveillon, etc.)
//   - LISTING SEASON  = instância do template para uma listing (vive em
//     /parr/listing-rates-sell). Tem `_idseason` apontando para o template.
//
// Criação/edição de templates afeta TODAS as listings vinculadas à Region.

export interface SeasonTemplate {
    _id: string
    _idregion: string
    name: string
    hint: string
    type: "season" | "event"
    from: string
    to: string
    status: "active" | "inactive"
    ratePlans: RatePlan[]
    useMonthlyRate: boolean
}

export interface CreateSeasonTemplateInput {
    _idregion: string
    type: "season" | "event"
    name: string
    hint: string
    from: string
    to: string
    status?: "active" | "inactive"
    ratePlans: Array<{ minStay: number; _i_percent: number }>
    useMonthlyRate?: boolean
}

/** GET /parr/seasons-sell — lista templates. Filtra por `_idregion` opcional. */
export async function listSeasonTemplates(regionId?: string): Promise<SeasonTemplate[]> {
    const q = regionId ? `?_idregion=${encodeURIComponent(regionId)}` : ""
    return staysFetch<SeasonTemplate[]>(`/external/v1/parr/seasons-sell${q}`)
}

/** POST /parr/seasons-sell — cria template novo na region. Stays limita a 3 anos futuros. */
export async function createSeasonTemplate(input: CreateSeasonTemplateInput): Promise<SeasonTemplate> {
    return staysFetch<SeasonTemplate>("/external/v1/parr/seasons-sell", {
        method: "POST",
        body: {
            status: "active",
            useMonthlyRate: false,
            ...input,
        },
    })
}

/** PATCH /parr/seasons-sell/{id} — edita template (nome, datas, ratePlans). */
export async function patchSeasonTemplate(
    id: string,
    patch: Partial<Omit<SeasonTemplate, "_id" | "_idregion">>,
): Promise<SeasonTemplate> {
    return staysFetch<SeasonTemplate>(`/external/v1/parr/seasons-sell/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: patch,
    })
}

/** DELETE /parr/seasons-sell/{id} — remove template. */
export async function deleteSeasonTemplate(id: string): Promise<void> {
    await staysFetch<void>(`/external/v1/parr/seasons-sell/${encodeURIComponent(id)}`, {
        method: "DELETE",
    })
}

// ============================================================================
// Clone-groups (espelhamento de unidades)
// ============================================================================

/**
 * Clone-groups são "grupos espelho" da Stays — uma listing-mestre tem N
 * listings-filhas que herdam conteúdo + preço. Equivalente operacional do
 * Pricemaster_ID do BQ.
 *
 * NOTA: GET retorna 400 com mensagem específica quando o id passado NÃO é
 * master de nenhum grupo. Usamos isso pra detectar status:
 *   - 200 OK → essa listing É master, retorna items[]
 *   - 400 "is not master" → essa listing é stand-alone OU é filha de outra
 *
 * Pra resolver "filha", precisamos do master via outro caminho (BQ
 * Pricemaster_ID). O endpoint não oferece "qual o master desta filha".
 */

export interface CloneGroup {
    masterId: string
    name: string
    visibleItems: number
    totalItems: number
    items: Array<{
        internalName: string
        status: string
        _idlisting: string
        visible: boolean
    }>
}

/**
 * Tenta buscar o clone-group cujo master é o listingId fornecido.
 * Se a listing não for master, retorna null (não dispara exceção).
 */
export async function getCloneGroupAsMaster(listingId: string): Promise<CloneGroup | null> {
    try {
        return await staysFetch<CloneGroup>(
            `/external/v1/content/clone-groups/${encodeURIComponent(listingId)}`,
        )
    } catch (e) {
        if (e instanceof StaysApiError && e.status === 400) {
            const body = typeof e.body === "object" ? JSON.stringify(e.body) : String(e.body)
            if (/not master of clone group/i.test(body)) return null
        }
        throw e
    }
}

/**
 * Análogo a getCloneGroupAsMaster mas para price-groups (espelhamento só de preço).
 */
export async function getPriceGroupAsMaster(listingId: string): Promise<CloneGroup | null> {
    try {
        return await staysFetch<CloneGroup>(
            `/external/v1/content/price-groups/${encodeURIComponent(listingId)}`,
        )
    } catch (e) {
        if (e instanceof StaysApiError && e.status === 400) {
            const body = typeof e.body === "object" ? JSON.stringify(e.body) : String(e.body)
            if (/not master of price group/i.test(body)) return null
        }
        throw e
    }
}

// ============================================================================
// Helpers de alto nível
// ============================================================================

/** Pega 365 dias de seasons a partir de hoje. */
export async function snapshotSeasonsForYear(listingId: string): Promise<ListingSeason[]> {
    const today = new Date()
    const from = today.toISOString().slice(0, 10)
    const to = new Date(today.getTime() + 365 * 86400000).toISOString().slice(0, 10)
    return listListingSeasons({ listingId, from, to })
}

/**
 * Aplica um lote de baseRateValue. Itera, captura erros 400 Monthly rate
 * e marca pra retry. Não tenta retry automaticamente — devolve a lista
 * de pendentes pra UI lidar.
 */
export interface ApplyResult {
    successes: Array<{ seasonId: string; baseRate: number }>
    failures: Array<{ seasonId: string; status: number; message: string; needsMonthlyRate: boolean }>
}

export async function applySeasonPrices(params: {
    listingId: string
    updates: Array<{ seasonId: string; baseRate: number; monthlyRate?: number }>
    dryRun?: boolean
}): Promise<ApplyResult> {
    const result: ApplyResult = { successes: [], failures: [] }

    for (const u of params.updates) {
        if (params.dryRun) {
            // Simula: registra como sucesso mas não chama API.
            result.successes.push({ seasonId: u.seasonId, baseRate: u.baseRate })
            continue
        }
        try {
            const body: SeasonPatch = { type: "global", baseRateValue: u.baseRate }
            if (u.monthlyRate != null) body.monthlyRateValue = u.monthlyRate
            await patchListingSeason({
                listingId: params.listingId,
                seasonId: u.seasonId,
                body,
            })
            result.successes.push({ seasonId: u.seasonId, baseRate: u.baseRate })
        } catch (e) {
            if (e instanceof StaysApiError) {
                const msg = typeof e.body === "object" ? JSON.stringify(e.body) : String(e.body)
                result.failures.push({
                    seasonId: u.seasonId,
                    status: e.status,
                    message: msg,
                    needsMonthlyRate: e.status === 400 && /monthly\s*rate/i.test(msg),
                })
            } else {
                result.failures.push({
                    seasonId: u.seasonId,
                    status: 0,
                    message: (e as Error).message,
                    needsMonthlyRate: false,
                })
            }
        }
    }
    return result
}

// ============================================================================
// JSON-RPC (cookie de sessão) — métodos internos da Stays
// ============================================================================
//
// A REST `/external/v1/` não expõe vínculo de listing↔region nem promoções
// percentuais. Esses fluxos vivem só no JSON-RPC interno, que está bloqueado
// pra Basic auth (`HTTP 403 "JSONRPC from external"`) mas funciona com cookie
// de sessão — ver lib/stays/session-client.ts.

/**
 * Vincula uma listing a uma price-region (equivalente ao "Configuração geral
 * de preço → escolher Região → Salvar" na UI Stays).
 *
 * Método: `apartment.saveApartment` com payload mínimo:
 *   { _id: listingObjectId, _idregion: priceRegionId }
 *
 * O Colab original também envia `deff_curr: "BRL"` e `_t_unset: {...}` — não
 * são obrigatórios pra mudar a region, mas se a chamada falhar com schema
 * error, dá pra reenviar com esses campos.
 *
 * Em `dryRun=true` apenas loga e devolve `{ dryRun: true }` sem chamar API.
 */
export async function linkListingToRegion(params: {
    listingId: string // _id ObjectId da listing
    regionId: string // _id da price-region (ex: "Rota Milagres")
    dryRun?: boolean
}): Promise<{ dryRun: boolean; result?: unknown }> {
    if (params.dryRun) {
        console.log(
            `[stays:dry-run] linkListingToRegion listing=${params.listingId} → region=${params.regionId}`,
        )
        return { dryRun: true }
    }

    const result = await staysJsonRpc("apartment.saveApartment", [
        "",
        { _id: params.listingId, _idregion: params.regionId },
    ])
    return { dryRun: false, result }
}

/**
 * Aplica desconto/aumento percentual em um range de datas (equivalente ao
 * popup "Editar promoção" na UI Stays do calendário).
 *
 * Método: `promotion.editPromotionSimple` com:
 *   { _dtfrom, _dtto, weekdays, _f_value, _b_rise, _idapartment }
 *
 * - `value`: percentual (ex. 13 = 13%)
 * - `isIncrease=false`: desconto (`_b_rise=0`)
 * - `isIncrease=true`:  aumento  (`_b_rise=1`)
 * - `weekdays`: array de 0=Dom..6=Sáb (default = todos os dias)
 */
export async function applyPromotion(params: {
    listingPartnerCode: string // ID curto (ex. "RD06H") — o JSON-RPC usa o curto, não o _id
    from: string // YYYY-MM-DD
    to: string // YYYY-MM-DD
    value: number // 0-100
    isIncrease?: boolean
    weekdays?: number[]
    dryRun?: boolean
}): Promise<{ dryRun: boolean; result?: unknown }> {
    if (params.value < 0 || params.value > 100) {
        throw new Error(`applyPromotion: value fora do range 0-100 (recebido ${params.value})`)
    }

    if (params.dryRun) {
        console.log(
            `[stays:dry-run] applyPromotion apt=${params.listingPartnerCode} ${params.from}→${params.to} ${params.isIncrease ? "+" : "-"}${params.value}%`,
        )
        return { dryRun: true }
    }

    const result = await staysJsonRpc(
        "promotion.editPromotionSimple",
        [
            "",
            {
                _dtfrom: `${params.from}T12:00:00.00Z`,
                _dtto: `${params.to}T12:00:00.00Z`,
                weekdays: params.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
                _f_value: params.value,
                _b_rise: params.isIncrease ? 1 : 0,
                _idapartment: params.listingPartnerCode,
            },
        ],
        { referer: "https://beto.stays.com.br/i/calendars" },
    )
    return { dryRun: false, result }
}

/** Re-export para callers que precisam tratar StaysSessionError. */
export { StaysSessionError }
