/**
 * Step 01e: Detecta espelhamento (clone-group / price-group) da listing na Stays.
 *
 * Combina 2 sinais:
 *   1. Pricemaster_ID do BQ (se != listing._id, é filha)
 *   2. GET /content/{clone|price}-groups/{listingId} — se 200, é master
 *
 * Saída:
 *   - role: "standalone" | "master" | "follower"
 *   - se master: lista de filhas (do clone-group)
 *   - se follower: id do master (do BQ — não tem API pra resolver)
 */

import {
    getCloneGroupAsMaster,
    getPriceGroupAsMaster,
    type CloneGroup,
} from "@/lib/stays/pricing"
import type { StaysResolveResult } from "./01b-stays-resolve-id"

export interface MirrorInfo {
    role: "standalone" | "master" | "follower"
    /** Quando é master, lista das filhas via API. */
    children?: Array<{ idlisting: string; internalName: string; visible: boolean }>
    /** Quando é follower, info da unidade-mãe (vinda do BQ). */
    master_listing_id?: string
    master_name?: string
    /** Tipo do grupo detectado pela API. */
    group_type?: "clone" | "price"
    /** Quando deu erro ao consultar API. */
    error?: string
}

export async function staysDetectMirror(
    listingId: string | null,
    resolveResult: StaysResolveResult,
): Promise<MirrorInfo> {
    // Caso 1: BQ diz que é filha (Pricemaster_ID != própria listing)
    if (resolveResult.is_mirror) {
        return {
            role: "follower",
            master_listing_id: listingId || undefined,
            master_name: resolveResult.mirror_of_name || undefined,
        }
    }

    if (!listingId) {
        return { role: "standalone" }
    }

    // Caso 2: tenta como master de clone-group, depois de price-group.
    let group: CloneGroup | null = null
    let groupType: "clone" | "price" | undefined
    try {
        group = await getCloneGroupAsMaster(listingId)
        if (group) groupType = "clone"
    } catch (e) {
        return { role: "standalone", error: `clone-group: ${(e as Error).message}` }
    }
    if (!group) {
        try {
            group = await getPriceGroupAsMaster(listingId)
            if (group) groupType = "price"
        } catch (e) {
            return { role: "standalone", error: `price-group: ${(e as Error).message}` }
        }
    }

    if (group) {
        return {
            role: "master",
            group_type: groupType,
            children: group.items.map((it) => ({
                idlisting: it._idlisting,
                internalName: it.internalName,
                visible: it.visible,
            })),
        }
    }

    return { role: "standalone" }
}
