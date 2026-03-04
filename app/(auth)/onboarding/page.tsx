"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

const TACTICAL_LEVELS = [
    { value: "estrategico", label: "Estratégico", description: "Visão geral do negócio, metas e resultados" },
    { value: "tatico", label: "Tático", description: "Gestão de equipes, análise de performance" },
    { value: "operacional", label: "Operacional", description: "Execução diária, precificação, reservas" },
]

export default function OnboardingPage() {
    const { data: session } = useSession()
    const router = useRouter()
    const [tacticalLevel, setTacticalLevel] = useState<string | null>(null)
    const [isPricingSector, setIsPricingSector] = useState<boolean | null>(null)
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState(1)

    const handleSubmit = async () => {
        if (!tacticalLevel || isPricingSector === null) return
        setLoading(true)

        try {
            const res = await fetch("/api/auth/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tactical_level: tacticalLevel,
                    is_pricing_sector: isPricingSector,
                }),
            })

            if (res.ok) {
                router.push("/")
                router.refresh()
            }
        } catch {
            // silently retry on next attempt
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Bem-vindo ao Price.OS</CardTitle>
                    <CardDescription>
                        {session?.user?.name ? `Olá, ${session.user.name.split(" ")[0]}! ` : ""}
                        Precisamos de algumas informações para personalizar sua experiência.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            <Label className="text-base font-medium">Qual é o seu nível de atuação?</Label>
                            <div className="space-y-2">
                                {TACTICAL_LEVELS.map((level) => (
                                    <button
                                        key={level.value}
                                        onClick={() => setTacticalLevel(level.value)}
                                        className={`w-full rounded-lg border p-4 text-left transition-colors ${
                                            tacticalLevel === level.value
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/50"
                                        }`}
                                    >
                                        <p className="font-medium">{level.label}</p>
                                        <p className="text-sm text-muted-foreground">{level.description}</p>
                                    </button>
                                ))}
                            </div>
                            <Button
                                className="w-full"
                                disabled={!tacticalLevel}
                                onClick={() => setStep(2)}
                            >
                                Continuar
                            </Button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <Label className="text-base font-medium">Você atua no setor de precificação?</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setIsPricingSector(true)}
                                    className={`rounded-lg border p-4 text-center transition-colors ${
                                        isPricingSector === true
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50"
                                    }`}
                                >
                                    <p className="font-medium">Sim</p>
                                    <p className="text-sm text-muted-foreground">Atuo com pricing</p>
                                </button>
                                <button
                                    onClick={() => setIsPricingSector(false)}
                                    className={`rounded-lg border p-4 text-center transition-colors ${
                                        isPricingSector === false
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50"
                                    }`}
                                >
                                    <p className="font-medium">Não</p>
                                    <p className="text-sm text-muted-foreground">Outro setor</p>
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                                    Voltar
                                </Button>
                                <Button
                                    className="flex-1"
                                    disabled={isPricingSector === null || loading}
                                    onClick={handleSubmit}
                                >
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Começar
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
