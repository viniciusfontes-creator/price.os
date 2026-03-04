"use client"

import { ViewContextProvider } from "@/contexts/view-context"

export default function SelectViewLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ViewContextProvider>
            {children}
        </ViewContextProvider>
    )
}
