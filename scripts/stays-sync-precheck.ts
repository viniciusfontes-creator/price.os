/**
 * Pre-check da integração Price.OS → Stays para o fluxo de aprovação individual.
 *
 * Read-only: NUNCA faz PATCH. Apenas:
 *   1. Pinga a Stays (verifica auth)
 *   2. Pega algumas propostas pendentes/aprovadas do Supabase
 *   3. Resolve listing_id via warehouse.propriedades_subgrupos (BQ)
 *   4. Lista seasons da Stays no range do period
 *   5. Identifica a season alvo (mesma lógica do helper)
 *   6. Mostra o body PATCH que SERIA enviado
 *
 * Roda com: npx tsx scripts/stays-sync-precheck.ts
 */

import "dotenv/config"
import { pingStays } from "@/lib/stays/client"
import { listListingSeasons } from "@/lib/stays/pricing"
import { executeQuery } from "@/lib/bigquery-client"
import { getSupabaseAdmin } from "@/lib/supabase-server"

const SQL_RESOLVE = `
SELECT CAST(Pricemaster_ID AS STRING) AS pricemaster_id,
       CAST(nomePropriedade AS STRING) AS nome
FROM \`warehouse.propriedades_subgrupos\`
WHERE CAST(idPropriedade AS STRING) = @idpropriedade
LIMIT 1
`

async function main() {
    console.log("=".repeat(70))
    console.log("STAYS SYNC PRE-CHECK")
    console.log("=".repeat(70))

    // 1. Ping
    console.log("\n[1/5] Ping na Stays API...")
    const ok = await pingStays()
    console.log(ok ? "  ✓ auth OK" : "  ✗ auth FALHOU — abortando")
    if (!ok) process.exit(1)

    // 2. Pega propostas representativas do Supabase
    console.log("\n[2/5] Buscando propostas no Supabase...")
    const supabase = getSupabaseAdmin()
    if (!supabase) {
        console.error("  ✗ Supabase não configurado")
        process.exit(1)
    }

    const { data: propostas, error } = await supabase
        .from("pricing_ajustes_propostos")
        .select(
            "id, idpropriedade, nomepropriedade, praca, period_id, periodo_nome, periodo_inicio, periodo_fim, baserate_atual, baserate_sugerido, baserate_aplicado, delta_pct, status",
        )
        .eq("status", "pendente")
        .order("delta_pct", { ascending: false })
        .limit(5)

    if (error || !propostas || propostas.length === 0) {
        console.error("  ✗ Nenhuma proposta pendente encontrada", error)
        process.exit(1)
    }
    console.log(`  ✓ ${propostas.length} propostas pendentes amostradas`)

    // 3-6. Para cada uma, faz o pipeline
    let i = 0
    for (const p of propostas) {
        i += 1
        console.log("\n" + "─".repeat(70))
        console.log(`[Amostra ${i}/${propostas.length}] proposta #${p.id}`)
        console.log(`  Propriedade: ${p.nomepropriedade ?? "—"} (${p.idpropriedade}) — ${p.praca ?? "—"}`)
        console.log(`  Período: ${p.periodo_nome} (${p.periodo_inicio} → ${p.periodo_fim})`)
        console.log(`  Baserate: ${p.baserate_atual} → ${p.baserate_sugerido} (Δ ${p.delta_pct}%)`)

        // 3. resolve listing
        let listingId: string | null = null
        let listingName: string | null = null
        try {
            const rows = await executeQuery<{ pricemaster_id: string | null; nome: string | null }>(
                SQL_RESOLVE,
                { idpropriedade: p.idpropriedade },
            )
            listingId = rows[0]?.pricemaster_id ?? null
            listingName = rows[0]?.nome ?? null
        } catch (e) {
            console.log(`  ✗ BQ resolve falhou: ${(e as Error).message}`)
            continue
        }
        if (!listingId) {
            console.log("  ✗ Pricemaster_ID nulo no warehouse — UNMAPPED")
            continue
        }
        console.log(`  ✓ stays_listing_id: ${listingId} (warehouse name: ${listingName})`)

        // 4. listar seasons
        let seasons: Awaited<ReturnType<typeof listListingSeasons>>
        try {
            seasons = await listListingSeasons({
                listingId,
                from: p.periodo_inicio,
                to: p.periodo_fim,
            })
        } catch (e) {
            console.log(`  ✗ listListingSeasons falhou: ${(e as Error).message}`)
            continue
        }
        console.log(`  ✓ ${seasons.length} season(s) retornadas pela Stays no range`)
        for (const s of seasons) {
            console.log(
                `      • ${s._idseason} type=${s.type} status=${s.status} from=${s.from} to=${s.to} baseRate=${s.baseRateValue}${s.monthlyRate ? " [mensal]" : ""}`,
            )
        }

        // 5. identifica a season alvo (mesma regra do helper: mais específica vence)
        const covering = seasons.filter(
            (s) => s.status === "active" && s.from <= p.periodo_inicio && s.to >= p.periodo_fim,
        )
        if (covering.length === 0) {
            console.log("  ✗ Nenhuma season ATIVA cobre o range — UNMAPPED")
            continue
        }
        const daySpan = (s: { from: string; to: string }) =>
            (new Date(s.to).getTime() - new Date(s.from).getTime()) / 86400000
        const sorted = [...covering].sort((a, b) => daySpan(a) - daySpan(b))
        const minSpan = daySpan(sorted[0])
        const tied = sorted.filter((s) => daySpan(s) === minSpan)
        if (tied.length > 1) {
            console.log(`  ✗ AMBÍGUO: ${tied.length} seasons com mesmo span — UNMAPPED`)
            continue
        }
        const target = sorted[0]
        if (covering.length > 1) {
            console.log(`  ℹ ${covering.length} seasons cobrem; escolhi a mais específica (${minSpan} dias)`)
        }
        console.log(
            `  ✓ Season alvo: ${target._idseason} (cobre ${target.from}..${target.to}, baserate atual na Stays: ${target.baseRateValue})`,
        )

        // 6. payload PATCH que seria enviado
        const valorFinal = p.baserate_aplicado ?? p.baserate_sugerido
        const body: Record<string, unknown> = {
            type: "global",
            baseRateValue: Number(valorFinal),
        }
        if (target.monthlyRate) {
            console.log("  ⚠ Esta season tem monthlyRate — pode precisar monthlyRateValue (errors esperados na 1ª run)")
        }
        console.log("  → PATCH /external/v1/parr/listing-rates-sell/" + target._idseason)
        console.log("    body:", JSON.stringify(body))

        const baseRateAtualStays = Number(target.baseRateValue)
        const baseRatePropostoPriceos = Number(p.baserate_atual)
        if (Math.abs(baseRateAtualStays - baseRatePropostoPriceos) > 1) {
            console.log(
                `  ⚠ Divergência: baserate atual Stays=${baseRateAtualStays} vs Price.OS=${baseRatePropostoPriceos}. Pode indicar que a proposta foi gerada com snapshot antigo, ou que a season alvo está errada.`,
            )
        } else {
            console.log("  ✓ baserate atual bate entre Stays e Price.OS")
        }
    }

    console.log("\n" + "=".repeat(70))
    console.log("PRE-CHECK COMPLETO — nenhum PATCH enviado.")
    console.log("=".repeat(70))
}

main().catch((e) => {
    console.error("\nFATAL", e)
    process.exit(1)
})
