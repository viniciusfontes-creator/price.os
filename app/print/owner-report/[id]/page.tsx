import { notFound } from "next/navigation"
import { getOwnerReport } from "@/lib/owner-report/repository"
import { SlideRenderer } from "@/components/owner-report/slide-renderer"

// TODO(segurança): rota /print é pública (middleware exclui). Hoje só é acessível
// quem conhece o UUID. Antes de share links externos, validar token assinado
// e/ou cookie de sessão do autor.

export const dynamic = "force-dynamic"
export const revalidate = 0

interface Props {
  params: { id: string }
}

export default async function PrintOwnerReportPage({ params }: Props) {
  const row = await getOwnerReport(params.id)
  if (!row) notFound()

  return <SlideRenderer slides={row.slides} snapshot={row.snapshot_data || {}} />
}
