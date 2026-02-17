"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { Database, Server, BarChart3, CheckCircle2 } from "lucide-react"

interface InitialLoadingScreenProps {
    className?: string
}

interface LoadingStep {
    id: string
    label: string
    icon: React.ElementType
    status: "pending" | "loading" | "complete"
}

const LOADING_STEPS: LoadingStep[] = [
    { id: "connect", label: "Conectando ao BigQuery", icon: Database, status: "pending" },
    { id: "properties", label: "Carregando propriedades", icon: Server, status: "pending" },
    { id: "reservations", label: "Processando reservas", icon: BarChart3, status: "pending" },
    { id: "metrics", label: "Calculando métricas", icon: CheckCircle2, status: "pending" },
]

export function InitialLoadingScreen({ className }: InitialLoadingScreenProps) {
    const [steps, setSteps] = useState<LoadingStep[]>(LOADING_STEPS)
    const [progress, setProgress] = useState(0)
    const [currentStepIndex, setCurrentStepIndex] = useState(0)

    useEffect(() => {
        // Simular progresso baseado no tempo médio de carregamento
        const durations = [800, 1500, 2000, 1000] // Durações estimadas para cada step
        let timeout: NodeJS.Timeout

        const updateStep = (index: number) => {
            if (index >= LOADING_STEPS.length) return

            // Marcar step atual como loading
            setSteps(prev => prev.map((step, i) => ({
                ...step,
                status: i < index ? "complete" : i === index ? "loading" : "pending"
            })))
            setCurrentStepIndex(index)

            // Atualizar progresso gradualmente
            const startProgress = (index / LOADING_STEPS.length) * 100
            const endProgress = ((index + 1) / LOADING_STEPS.length) * 100
            const duration = durations[index]
            const increment = (endProgress - startProgress) / (duration / 50)

            let currentProgress = startProgress
            const progressInterval = setInterval(() => {
                currentProgress += increment
                if (currentProgress >= endProgress) {
                    currentProgress = endProgress
                    clearInterval(progressInterval)
                }
                setProgress(currentProgress)
            }, 50)

            // Próximo step
            timeout = setTimeout(() => {
                clearInterval(progressInterval)
                setSteps(prev => prev.map((step, i) => ({
                    ...step,
                    status: i <= index ? "complete" : step.status
                })))
                updateStep(index + 1)
            }, duration)
        }

        updateStep(0)

        return () => {
            clearTimeout(timeout)
        }
    }, [])

    return (
        <div className={cn("min-h-[60vh] flex items-center justify-center", className)}>
            <Card className="w-full max-w-md mx-4 border-2 shadow-lg">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 relative">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <Database className="w-8 h-8 text-primary animate-pulse" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-primary animate-ping" />
                        </div>
                    </div>
                    <h2 className="text-xl font-semibold">Carregando Dashboard</h2>
                    <p className="text-sm text-muted-foreground">
                        Buscando dados do BigQuery...
                    </p>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progresso</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Steps List */}
                    <div className="space-y-3">
                        {steps.map((step, index) => {
                            const Icon = step.icon
                            return (
                                <div
                                    key={step.id}
                                    className={cn(
                                        "flex items-center gap-3 p-2 rounded-lg transition-all duration-300",
                                        step.status === "loading" && "bg-primary/5",
                                        step.status === "complete" && "opacity-60"
                                    )}
                                >
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                                        step.status === "pending" && "bg-muted text-muted-foreground",
                                        step.status === "loading" && "bg-primary/20 text-primary",
                                        step.status === "complete" && "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                    )}>
                                        {step.status === "complete" ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                        ) : step.status === "loading" ? (
                                            <Icon className="w-4 h-4 animate-pulse" />
                                        ) : (
                                            <Icon className="w-4 h-4" />
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-sm font-medium transition-all duration-300",
                                        step.status === "pending" && "text-muted-foreground",
                                        step.status === "loading" && "text-foreground",
                                        step.status === "complete" && "text-muted-foreground"
                                    )}>
                                        {step.label}
                                        {step.status === "loading" && (
                                            <span className="ml-2 text-xs text-primary">processando...</span>
                                        )}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Footer message */}
                    <p className="text-xs text-center text-muted-foreground pt-2 border-t">
                        Primeira carga pode levar alguns segundos.
                        <br />
                        <span className="text-primary">Próximas navegações serão instantâneas!</span>
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}

// Skeleton components for page-specific loading (revalidation)
function KPICardSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-2 w-full mb-2" />
                <Skeleton className="h-3 w-20" />
            </CardContent>
        </Card>
    )
}

function ChartSkeleton({ height = "h-[300px]" }: { height?: string }) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-5 w-40 mb-1" />
                <Skeleton className="h-3 w-28" />
            </CardHeader>
            <CardContent>
                <div className={cn("relative", height)}>
                    <div className="absolute inset-0 flex items-end justify-between gap-2 p-4">
                        {[...Array(8)].map((_, i) => (
                            <Skeleton
                                key={i}
                                className="flex-1 rounded-t-sm"
                                style={{ height: `${Math.random() * 60 + 30}%` }}
                            />
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-5 w-48 mb-1" />
                <Skeleton className="h-3 w-32" />
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <div className="flex gap-4 pb-2 border-b">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                    {[...Array(rows)].map((_, i) => (
                        <div key={i} className="flex gap-4 items-center">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-6 w-16 rounded-full" />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

function BasketListSkeleton() {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-8 w-24 rounded-md" />
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-3 border rounded-lg space-y-2">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-4 rounded-full" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <Skeleton className="h-5 w-20 rounded-full" />
                            <Skeleton className="h-5 w-14 rounded-full" />
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}

// Dashboard Skeleton (for background revalidation)
export function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Skeleton className="h-8 w-40 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                </div>
            </div>
            <Card className="p-4">
                <div className="flex gap-4">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-24" />
                </div>
            </Card>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <KPICardSkeleton key={i} />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartSkeleton />
                <ChartSkeleton />
            </div>
        </div>
    )
}

export function VendasSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-48" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <KPICardSkeleton key={i} />
                ))}
            </div>
            <ChartSkeleton height="h-[350px]" />
            <TableSkeleton rows={6} />
        </div>
    )
}

export function CorrelacaoSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div>
                    <Skeleton className="h-7 w-56 mb-1" />
                    <Skeleton className="h-4 w-80" />
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-3">
                    <BasketListSkeleton />
                </div>
                <div className="lg:col-span-9 space-y-6">
                    <Card className="p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <Skeleton className="h-6 w-40 mb-2" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-5 w-24 rounded-full" />
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                    <Skeleton className="h-5 w-28 rounded-full" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Skeleton className="h-9 w-32 rounded-md" />
                                <Skeleton className="h-9 w-20 rounded-md" />
                            </div>
                        </div>
                    </Card>
                    <ChartSkeleton height="h-[400px]" />
                </div>
            </div>
        </div>
    )
}

export function PricingSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-72" />
            </div>
            <div className="flex gap-2">
                <Skeleton className="h-10 w-36 rounded-md" />
                <Skeleton className="h-10 w-44 rounded-md" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <KPICardSkeleton key={i} />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartSkeleton />
                <ChartSkeleton />
            </div>
        </div>
    )
}

interface PageSkeletonProps {
    variant?: "dashboard" | "table" | "chart" | "cards" | "correlacao"
    className?: string
}

export function PageSkeleton({ variant = "dashboard", className }: PageSkeletonProps) {
    switch (variant) {
        case "correlacao":
            return <CorrelacaoSkeleton />
        case "table":
            return (
                <div className={cn("space-y-6 animate-in fade-in duration-500", className)}>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-48" />
                    </div>
                    <TableSkeleton rows={8} />
                </div>
            )
        case "chart":
            return (
                <div className={cn("space-y-6 animate-in fade-in duration-500", className)}>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-48" />
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <KPICardSkeleton key={i} />
                        ))}
                    </div>
                    <ChartSkeleton height="h-[400px]" />
                </div>
            )
        case "cards":
            return (
                <div className={cn("space-y-6 animate-in fade-in duration-500", className)}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(8)].map((_, i) => (
                            <KPICardSkeleton key={i} />
                        ))}
                    </div>
                </div>
            )
        default:
            return <DashboardSkeleton />
    }
}

export { KPICardSkeleton, ChartSkeleton, TableSkeleton, BasketListSkeleton }
