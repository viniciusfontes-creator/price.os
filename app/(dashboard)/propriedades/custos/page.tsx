import { Metadata } from "next"
import { CustosClient } from "./_components/custos-client"

export const metadata: Metadata = {
    title: "Gestão de Custos | Price.OS",
    description: "Gerencie custos fixos e variáveis das unidades",
}

export default function GestaoCustosPage() {
    return <CustosClient />
}
