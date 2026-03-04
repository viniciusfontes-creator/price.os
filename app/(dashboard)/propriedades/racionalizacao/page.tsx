import { Metadata } from "next"
import { RacionalizacaoClient } from "./_components/racionalizacao-client"

export const metadata: Metadata = {
    title: "Racionalização e Benchmarking | Price.OS",
    description: "Crie regras de precificação relativa entre unidades similares",
}

export default function RacionalizacaoPage() {
    return <RacionalizacaoClient />
}
