/**
 * Repository — proprietario_reports.
 *
 * Wrappers tipados sobre `getSupabaseAdmin()`. Não fazem auth checks: quem chamar
 * deve ter filtrado por `created_by_email` ou ser admin.
 */

import { getSupabaseAdmin } from "@/lib/supabase-server"
import type { SlideConfig } from "./templates"

export interface OwnerReportRow {
  id: string
  created_by_email: string
  idpropriedade: string
  nome_propriedade: string | null
  periodo_inicio: string // YYYY-MM-DD
  periodo_fim: string
  template_key: string
  status: "draft" | "published" | "archived"
  slides: SlideConfig[]
  snapshot_data: Record<string, unknown> | null
  pdf_url: string | null
  share_token: string | null
  share_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateOwnerReportInput {
  created_by_email: string
  idpropriedade: string
  nome_propriedade?: string
  periodo_inicio: string
  periodo_fim: string
  template_key?: string
  slides: SlideConfig[]
  snapshot_data?: Record<string, unknown>
}

const TABLE = "proprietario_reports"

function client() {
  const sb = getSupabaseAdmin()
  if (!sb) throw new Error("Supabase admin client unavailable (missing env)")
  return sb
}

export async function createOwnerReport(
  input: CreateOwnerReportInput
): Promise<OwnerReportRow> {
  const { data, error } = await client()
    .from(TABLE)
    .insert({
      created_by_email: input.created_by_email,
      idpropriedade: input.idpropriedade,
      nome_propriedade: input.nome_propriedade ?? null,
      periodo_inicio: input.periodo_inicio,
      periodo_fim: input.periodo_fim,
      template_key: input.template_key ?? "mensal_v1",
      slides: input.slides,
      snapshot_data: input.snapshot_data ?? null,
    })
    .select("*")
    .single()
  if (error) throw error
  return data as OwnerReportRow
}

export async function getOwnerReport(id: string): Promise<OwnerReportRow | null> {
  const { data, error } = await client().from(TABLE).select("*").eq("id", id).maybeSingle()
  if (error) throw error
  return (data as OwnerReportRow) || null
}

export async function listOwnerReports(email: string): Promise<OwnerReportRow[]> {
  const { data, error } = await client()
    .from(TABLE)
    .select("*")
    .eq("created_by_email", email)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw error
  return (data as OwnerReportRow[]) || []
}

export interface UpdateOwnerReportInput {
  slides?: SlideConfig[]
  status?: OwnerReportRow["status"]
  pdf_url?: string | null
  share_token?: string | null
  share_expires_at?: string | null
}

export async function updateOwnerReport(
  id: string,
  patch: UpdateOwnerReportInput
): Promise<OwnerReportRow> {
  const { data, error } = await client()
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data as OwnerReportRow
}
