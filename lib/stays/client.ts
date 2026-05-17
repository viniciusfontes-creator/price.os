/**
 * Cliente HTTP para a Stays External API.
 *
 * Doc: https://stays.net/external-api/
 * Swagger do tenant: {STAYS_BASE_URL}/external/v1/docs/
 *
 * Autenticação: Basic auth com base64(client_id:client_secret).
 * As mesmas credenciais que a Stays usa para autenticar webhooks enviados
 * ao Price.OS são as que usamos para chamar a API (par único por conta).
 *
 * Caminhos verificados empiricamente em beto.stays.com.br (a doc oficial
 * tem inconsistências — preferir os caminhos abaixo):
 *   GET    /external/v1/booking/searchfilter             (auth ping)
 *   GET    /external/v1/content/listings?limit&skip      (lista listings, retorna _id + partnerCode)
 *   GET    /external/v1/content/listings/{_id}           (detalhe via ObjectId)
 *   GET    /external/v1/calendar/listing/{_id}?from&to   (calendário com preços/disponibilidade)
 *   PATCH  /external/v1/calendar/listing/{_id}/prices    (atualiza preços por range)
 *   POST   /external/v1/booking/calculate-price          (dry-run de preço final)
 *
 * IDs: cada listing tem dois identificadores:
 *   - `_id`  (ObjectId Mongo, ex.: "69f8a4c3d00f35016925793b") — usado nos paths de calendar
 *   - `id`   (partnerCode curto, ex.: "JO01J") — bate com idpropriedade do BQ
 *
 * Schema de resposta do calendar (cada dia):
 *   { date, avail, closedToArrival, closedToDeparture,
 *     prices: [{ minStay, _mcval: { BRL, USD, EUR } }, ...] }
 * Atenção: cada dia tem MÚLTIPLOS preços simultâneos, um por minStay.
 * O minStay aplicado depende de quantas noites o hóspede vai ficar.
 */

const BASE_URL = process.env.STAYS_BASE_URL
const CLIENT_ID = process.env.STAYS_CLIENT_ID
const CLIENT_SECRET = process.env.STAYS_CLIENT_SECRET

export class StaysApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly body: unknown,
    ) {
        super(message)
        this.name = "StaysApiError"
    }
}

function authHeader(): string {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error("STAYS_CLIENT_ID / STAYS_CLIENT_SECRET não configurados")
    }
    const token = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
    return `Basic ${token}`
}

interface RequestOptions {
    method?: "GET" | "POST" | "PATCH" | "DELETE"
    query?: Record<string, string | number | boolean | undefined>
    body?: unknown
    timeoutMs?: number
}

export async function staysFetch<T = unknown>(
    path: string,
    opts: RequestOptions = {},
): Promise<T> {
    if (!BASE_URL) throw new Error("STAYS_BASE_URL não configurado")

    const url = new URL(path.startsWith("/") ? path : `/${path}`, BASE_URL)
    if (opts.query) {
        for (const [k, v] of Object.entries(opts.query)) {
            if (v !== undefined) url.searchParams.set(k, String(v))
        }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000)

    let res: Response
    try {
        res = await fetch(url.toString(), {
            method: opts.method ?? "GET",
            headers: {
                Authorization: authHeader(),
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
            signal: controller.signal,
        })
    } finally {
        clearTimeout(timeout)
    }

    const text = await res.text()
    const data = text ? safeJsonParse(text) : null

    if (!res.ok) {
        throw new StaysApiError(
            `Stays API ${opts.method ?? "GET"} ${path} → ${res.status}`,
            res.status,
            data ?? text,
        )
    }
    return data as T
}

function safeJsonParse(text: string): unknown {
    try { return JSON.parse(text) } catch { return text }
}

/** Sanity check: GET /external/v1/booking/searchfilter retorna 200 se auth OK. */
export async function pingStays(): Promise<boolean> {
    try {
        await staysFetch("/external/v1/booking/searchfilter")
        return true
    } catch (e) {
        if (e instanceof StaysApiError) {
            console.error("[stays] ping falhou", e.status, e.body)
        } else {
            console.error("[stays] ping erro", e)
        }
        return false
    }
}
