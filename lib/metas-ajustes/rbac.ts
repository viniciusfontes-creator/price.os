export const APPROVERS = [
  "viniciusfontes@quartoavista.com.br",
  "vitorferreira@quartoavista.com.br",
] as const

export function canApprove(email: string | null | undefined): boolean {
  if (!email) return false
  return APPROVERS.includes(email.toLowerCase() as (typeof APPROVERS)[number])
}
