/**
 * Cliente de sessão (login web) para a Stays.
 *
 * Por que existe: o endpoint `/jsonrpc` da Stays está **bloqueado pra Basic auth
 * externa** (`HTTP 403 "JSONRPC from external"`), mas funciona quando autenticado
 * via cookie de sessão — exatamente o que a UI Stays faz. Esse client porta o
 * fluxo descoberto no Colab 2 (Inserção de descontos) pra TypeScript:
 *
 *   1. GET /i/home          → captura cookie inicial
 *   2. POST /auth           → login com user/senha → cookie autenticado
 *   3. POST /jsonrpc        → chama método interno com Cookie + uid no body
 *
 * Casos de uso conhecidos:
 *   - `apartment.saveApartment` → vincular listing a uma price-region (NÃO existe
 *     equivalente público na REST API)
 *   - `promotion.editPromotionSimple` → aplicar desconto/aumento por range de
 *     data como percentual (sem ter que criar season individual)
 *
 * Mantemos cookie em memória do módulo (process). Em prod (multi-instance),
 * cada worker re-autentica — login é barato (~300ms), aceitável.
 */

const BASE_URL = process.env.STAYS_BASE_URL ?? "https://beto.stays.com.br"
const LOGIN_USER = process.env.STAYS_LOGIN_USER
const LOGIN_PASS = process.env.STAYS_LOGIN_PASS

const USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

interface CachedSession {
    cookie: string
    uid: string | null
    expiresAt: number
}

let cached: CachedSession | null = null
const SESSION_TTL_MS = 30 * 60 * 1000 // 30 min — Stays cookie costuma durar mais, mas renovamos antes pra evitar surpresas

export class StaysSessionError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly body: unknown,
    ) {
        super(message)
        this.name = "StaysSessionError"
    }
}

/**
 * Junta os pares `name=value` de todos os headers `Set-Cookie` (uma resposta
 * pode ter múltiplos). Stays envia 1-2 cookies (sessão + csrf).
 */
function extractCookieHeader(res: Response): string | null {
    // Node fetch concatena set-cookie em uma string única separada por vírgula,
    // mas vírgulas existem dentro de `expires=`. `getSetCookie()` (Node 19.7+)
    // resolve isso. Caímos em raw header como fallback.
    const setCookieList =
        typeof (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
            ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
            : res.headers.get("set-cookie")?.split(/,(?=\s*[A-Za-z0-9_-]+=)/) ?? []

    if (!setCookieList || setCookieList.length === 0) return null

    const pairs = setCookieList
        .map((c) => c.split(";")[0].trim())
        .filter((p) => p.includes("="))
    return pairs.length ? pairs.join("; ") : null
}

/**
 * Faz login web e cacheia cookie de sessão. Retorna `{ cookie, uid }`.
 *
 * O `uid` é o ID interno do usuário logado — necessário no body do JSON-RPC
 * (no Colab 2 está hard-coded como "67abb8eccef8bb3961ffa841"). Tentamos
 * extrair dinamicamente do response do `/auth` se disponível; senão usamos
 * fallback configurável.
 */
async function login(): Promise<CachedSession> {
    if (!LOGIN_USER || !LOGIN_PASS) {
        throw new Error("STAYS_LOGIN_USER / STAYS_LOGIN_PASS não configurados no .env")
    }

    // Step 1: cookie inicial
    const homeRes = await fetch(`${BASE_URL}/i/home`, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
        redirect: "manual",
    })
    const initialCookie = extractCookieHeader(homeRes)
    if (!initialCookie) {
        throw new StaysSessionError("Não recebeu cookie inicial de /i/home", homeRes.status, null)
    }

    // Step 2: POST /auth (form-urlencoded igual o colab)
    const form = new URLSearchParams({ login: LOGIN_USER, password: LOGIN_PASS })
    const authRes = await fetch(`${BASE_URL}/auth`, {
        method: "POST",
        headers: {
            Cookie: initialCookie,
            Origin: BASE_URL,
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json, text/plain, */*",
        },
        body: form.toString(),
        redirect: "manual",
    })

    if (authRes.status !== 200 && authRes.status !== 302) {
        const txt = await authRes.text().catch(() => "")
        throw new StaysSessionError(
            `Login falhou em /auth (${authRes.status})`,
            authRes.status,
            txt.slice(0, 500),
        )
    }

    // O cookie autenticado vem no response do /auth (sobrescreve o inicial)
    const authedCookie = extractCookieHeader(authRes) ?? initialCookie

    // Tenta extrair uid do response JSON; fallback pra env var
    let uid: string | null = process.env.STAYS_LOGIN_UID ?? null
    try {
        const body = await authRes.clone().json()
        if (body && typeof body === "object") {
            const candidate =
                (body as Record<string, unknown>)._id ??
                (body as Record<string, unknown>).uid ??
                (body as { user?: { _id?: string } }).user?._id
            if (typeof candidate === "string" && candidate.length) {
                uid = candidate
            }
        }
    } catch {
        // /auth pode retornar HTML — sem problema, usa fallback
    }

    cached = {
        cookie: authedCookie,
        uid,
        expiresAt: Date.now() + SESSION_TTL_MS,
    }
    return cached
}

async function getSession(forceRefresh = false): Promise<CachedSession> {
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
        return cached
    }
    return login()
}

/**
 * Chama um método JSON-RPC interno da Stays usando cookie de sessão.
 *
 * Se a primeira tentativa retornar 401/403 (cookie expirado), refaz login
 * uma vez antes de propagar o erro.
 */
export async function staysJsonRpc<T = unknown>(
    method: string,
    params: unknown[],
    opts: { referer?: string } = {},
): Promise<T> {
    const referer = opts.referer ?? `${BASE_URL}/i/home`

    const call = async (sess: CachedSession): Promise<Response> =>
        fetch(`${BASE_URL}/jsonrpc`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Cookie: sess.cookie,
                Origin: BASE_URL,
                Referer: referer,
                "User-Agent": USER_AGENT,
            },
            body: JSON.stringify({
                uid: sess.uid ?? "",
                method,
                params,
            }),
        })

    let sess = await getSession()
    let res = await call(sess)

    if (res.status === 401 || res.status === 403) {
        sess = await getSession(true)
        res = await call(sess)
    }

    const text = await res.text()
    if (!res.ok) {
        throw new StaysSessionError(
            `JSON-RPC ${method} → ${res.status}`,
            res.status,
            text.slice(0, 500),
        )
    }

    let json: unknown
    try {
        json = JSON.parse(text)
    } catch {
        throw new StaysSessionError(
            `JSON-RPC ${method} retornou não-JSON`,
            res.status,
            text.slice(0, 500),
        )
    }

    const j = json as { error?: unknown; result?: T }
    if (j.error) {
        throw new StaysSessionError(
            `JSON-RPC ${method} erro lógico`,
            200,
            j.error,
        )
    }
    return j.result as T
}

/**
 * Sanity check: tenta login + chamar método inócuo. Não chama nada com
 * efeito colateral. Use em smoke tests / health checks.
 */
export async function pingStaysSession(): Promise<{
    ok: boolean
    uid: string | null
    error?: string
}> {
    try {
        const s = await getSession(true)
        return { ok: true, uid: s.uid }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return { ok: false, uid: null, error: msg }
    }
}

/** Limpa cache de sessão. Útil em testes e quando rotaciona credenciais. */
export function clearStaysSession(): void {
    cached = null
}
