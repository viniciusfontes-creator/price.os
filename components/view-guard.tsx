"use client"

import { useRouter, usePathname } from "next/navigation"
import { useViewContext } from "@/contexts/view-context"
import { useEffect, useState } from "react"

export function ViewGuard({ children }: { children: React.ReactNode }) {
    const { hasSelectedView, isPageAllowed } = useViewContext()
    const router = useRouter()
    const pathname = usePathname()
    const [isChecking, setIsChecking] = useState(true)

    useEffect(() => {
        // Small delay to let localStorage hydrate
        const timer = setTimeout(() => {
            if (!hasSelectedView) {
                router.replace("/select-view")
            } else if (!isPageAllowed(pathname)) {
                router.replace("/")
            } else {
                setIsChecking(false)
            }
        }, 100)

        return () => clearTimeout(timer)
    }, [hasSelectedView, isPageAllowed, pathname, router])

    // Update checking state when view changes
    useEffect(() => {
        if (hasSelectedView && isPageAllowed(pathname)) {
            setIsChecking(false)
        }
    }, [hasSelectedView, isPageAllowed, pathname])

    if (isChecking) {
        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
                background: "hsl(var(--background))",
            }}>
                <div style={{
                    width: 32,
                    height: 32,
                    border: "3px solid hsl(var(--muted))",
                    borderTopColor: "hsl(var(--primary))",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                }} />
            </div>
        )
    }

    return <>{children}</>
}
