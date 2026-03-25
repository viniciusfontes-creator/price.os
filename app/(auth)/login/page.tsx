"use client"

import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, TrendingUp, Map, BarChart3, LineChart } from "lucide-react"

function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    )
}

const ERROR_MESSAGES: Record<string, string> = {
    domain: "Acesso restrito apenas a e-mails autorizados (Ex: @quartoavista.com.br)",
    OAuthSignin: "Erro ao iniciar login com Google. Tente novamente.",
    OAuthCallback: "Erro no retorno de autenticação. Tente novamente.",
    OAuthAccountNotLinked: "Este email já está associado a outra conta.",
    default: "Ocorreu um erro inesperado. Tente novamente ou contate o suporte.",
}

function LoginFormBlock() {
    const [loading, setLoading] = useState(false)
    const searchParams = useSearchParams()
    const errorParam = searchParams.get("error")

    const errorMessage = errorParam
        ? ERROR_MESSAGES[errorParam] || ERROR_MESSAGES.default
        : null

    const handleGoogleSignIn = () => {
        setLoading(true)
        signIn("google", { callbackUrl: "/" })
    }

    return (
        <div className="w-full max-w-[360px] mx-auto bg-white border border-gray-100 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8">
            <div className="text-center space-y-2 mb-8">
                <h2 className="text-xl font-medium text-gray-900 tracking-tight">
                    Acesso ao Sistema
                </h2>
                <p className="text-sm text-gray-500">
                    Faça login com seu e-mail corporativo.
                </p>
            </div>

            <div className="space-y-4">
                {errorMessage && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 text-center font-medium border border-red-100">
                        {errorMessage}
                    </div>
                )}

                <Button
                    variant="outline"
                    className="w-full h-12 bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900 font-medium transition-all"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                >
                    {loading ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
                    ) : (
                        <GoogleIcon className="mr-2 h-5 w-5" />
                    )}
                    Continuar com Google
                </Button>
            </div>
        </div>
    )
}

const features = [
    {
        title: "Monitor de Concorrência",
        description: "Busca de precisão com modelagem de similaridade IA e rastreio geográfico.",
        icon: <Map className="h-5 w-5 shrink-0" />
    },
    {
        title: "Modelagem de Preços",
        description: "Análise avançada da curva de precificação do mercado em tempo real.",
        icon: <LineChart className="h-5 w-5 shrink-0" />
    },
    {
        title: "Dashboards de Pace",
        description: "Acompanhamento fluido de conversões, ticket e ocupação por unidade.",
        icon: <TrendingUp className="h-5 w-5 shrink-0" />
    },
    {
        title: "BigData Nativo",
        description: "Infraestrutura escalável processando milhões de registros instantaneamente.",
        icon: <BarChart3 className="h-5 w-5 shrink-0" />
    }
];

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col items-center justify-center relative overflow-hidden">
            {/* Minimalist Background Subtle Gradient (Pure White with ultra-subtle primary tint) */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/[0.02] rounded-full blur-[100px] pointer-events-none translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/[0.015] rounded-full blur-[80px] pointer-events-none -translate-x-1/2 translate-y-1/2" />

            {/* Content Container */}
            <div className="w-full max-w-5xl px-6 py-12 lg:py-0 grid lg:grid-cols-2 gap-16 lg:gap-8 items-center z-10">
                
                {/* Left Side: Brand and Features */}
                <div className="flex flex-col space-y-10">
                    <div className="space-y-4">
                        <div className="w-10 h-10 rounded shadow-sm bg-primary flex items-center justify-center mb-6">
                            <span className="text-white font-bold text-xl leading-none">P</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900">
                            Price.OS
                        </h1>
                        <p className="text-base text-gray-500 max-w-md leading-relaxed">
                            Plataforma de inteligência comercial e performance construída para garantir dados confiáveis e decisões ultrarrápidas na Quarto à Vista.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-8 pt-4 border-t border-gray-100">
                        {features.map((feat, idx) => (
                            <div key={idx} className="flex gap-4">
                                <div className="text-primary mt-0.5">
                                    {feat.icon}
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-medium text-gray-900">{feat.title}</h3>
                                    <p className="text-xs text-gray-500 leading-relaxed max-w-[200px]">{feat.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Side: Login Panel */}
                <div className="flex justify-center lg:justify-end">
                    <Suspense fallback={
                        <div className="w-full max-w-[360px] h-[250px] border border-gray-100 rounded-xl flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
                        </div>
                    }>
                        <LoginFormBlock />
                    </Suspense>
                </div>
            </div>
            
            <div className="fixed bottom-6 text-center w-full z-10 px-6">
                <p className="text-[11px] font-medium text-gray-400 tracking-wide uppercase">
                    &copy; {new Date().getFullYear()} QUARTO À VISTA
                </p>
            </div>
        </div>
    )
}
