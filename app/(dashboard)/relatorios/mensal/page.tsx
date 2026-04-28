import { redirect } from "next/navigation"

export default function MonthlyReportIndex() {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  const mes = `${year}-${String(month).padStart(2, "0")}`
  redirect(`/relatorios/mensal/${mes}`)
}
