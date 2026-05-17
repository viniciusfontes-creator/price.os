/**
 * Gate de autenticação para endpoints admin de Stays.
 * Usa o mesmo NextAuth que protege as páginas autenticadas (/system/*).
 *
 * Em produção: exige sessão válida. Sem sessão → 401.
 * Em dev/preview (NODE_ENV !== "production"): passa para facilitar testes locais.
 */

import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { NextResponse } from "next/server"

export async function requireAdminSession(): Promise<{ ok: true; email: string } | { ok: false; response: NextResponse }> {
    if (process.env.NODE_ENV !== "production") {
        return { ok: true, email: "dev@local" }
    }
    const session = await getServerSession(authOptions)
    const email = session?.user?.email
    if (!email) {
        return {
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        }
    }
    return { ok: true, email }
}
