/**
 * GET /api/stays/dry-run-status
 *
 * Retorna o estado atual da flag dry-run por escopo. A UI usa isso para
 * mostrar banner amarelo quando o escopo `pricing` está em dry-run —
 * deixa explícito ao operador que aprovações NÃO estão chegando na Stays.
 */

import { NextResponse } from "next/server"
import { isStaysApplyDryRun } from "@/lib/stays/dry-run"

export const dynamic = "force-dynamic"

export async function GET() {
    return NextResponse.json({
        pricing: isStaysApplyDryRun("pricing"),
        onboarding: isStaysApplyDryRun("onboarding"),
        metas: isStaysApplyDryRun("metas"),
        calendar: isStaysApplyDryRun("calendar"),
    })
}
