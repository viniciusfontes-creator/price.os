"use client"

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { LogOut, UserCog, Loader2 } from "lucide-react"

const TACTICAL_LEVELS = [
    { value: "estrategico", label: "Estratégico" },
    { value: "tatico", label: "Tático" },
    { value: "operacional", label: "Operacional" },
]

export function UserMenu() {
    const { data: session } = useSession()
    const [open, setOpen] = useState(false)
    const [tacticalLevel, setTacticalLevel] = useState<string | null>(null)
    const [isPricingSector, setIsPricingSector] = useState<boolean | null>(null)
    const [loading, setLoading] = useState(false)
    const [loadingProfile, setLoadingProfile] = useState(false)
    const [saved, setSaved] = useState(false)

    if (!session?.user) return null

    const initials = session.user.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?"

    const handleOpenProfile = async () => {
        setOpen(true)
        setSaved(false)
        setLoadingProfile(true)

        try {
            const res = await fetch("/api/auth/profile")
            if (res.ok) {
                const data = await res.json()
                setTacticalLevel(data.tactical_level || null)
                setIsPricingSector(data.is_pricing_sector ?? null)
            }
        } catch {
            // use defaults
        } finally {
            setLoadingProfile(false)
        }
    }

    const handleSave = async () => {
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
                setSaved(true)
                setTimeout(() => setOpen(false), 800)
            }
        } catch {
            // silent
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={session.user.image || undefined} alt={session.user.name || ""} />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium">{session.user.name}</p>
                            <p className="text-xs text-muted-foreground">{session.user.email}</p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleOpenProfile} className="cursor-pointer">
                        <UserCog className="mr-2 h-4 w-4" />
                        Editar perfil
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="cursor-pointer text-destructive focus:text-destructive"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sair
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar perfil</DialogTitle>
                    </DialogHeader>

                    {loadingProfile ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-6 py-2">
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Nível de atuação</Label>
                                <div className="flex gap-2">
                                    {TACTICAL_LEVELS.map((level) => (
                                        <button
                                            key={level.value}
                                            onClick={() => setTacticalLevel(level.value)}
                                            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                                tacticalLevel === level.value
                                                    ? "border-primary bg-primary/5 font-medium"
                                                    : "border-border hover:border-primary/50"
                                            }`}
                                        >
                                            {level.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Setor de precificação?</Label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsPricingSector(true)}
                                        className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                            isPricingSector === true
                                                ? "border-primary bg-primary/5 font-medium"
                                                : "border-border hover:border-primary/50"
                                        }`}
                                    >
                                        Sim
                                    </button>
                                    <button
                                        onClick={() => setIsPricingSector(false)}
                                        className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                            isPricingSector === false
                                                ? "border-primary bg-primary/5 font-medium"
                                                : "border-border hover:border-primary/50"
                                        }`}
                                    >
                                        Não
                                    </button>
                                </div>
                            </div>

                            <Button
                                className="w-full"
                                onClick={handleSave}
                                disabled={!tacticalLevel || isPricingSector === null || loading}
                            >
                                {loading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : saved ? (
                                    "Salvo!"
                                ) : (
                                    "Salvar"
                                )}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
