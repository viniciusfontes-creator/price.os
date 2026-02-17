import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { ThemeProvider } from "next-themes"
import { ModeToggle } from "@/components/mode-toggle"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "Quarto a Vista - Performance Monitor",
  description: "Sistema de gerenciamento interno de precificacao e performance da Qavi",
  generator: "v0.app",
}

import { GlobalFiltersProvider } from "@/contexts/global-filters-context"
import { DashboardProvider } from "@/contexts/dashboard-provider"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <GlobalFiltersProvider>
            <DashboardProvider>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                  <header className="flex h-14 items-center gap-4 border-b px-6">
                    <SidebarTrigger />
                    <div className="ml-auto flex items-center gap-4">
                      <ModeToggle />
                    </div>
                  </header>
                  <main className="flex-1 p-6">{children}</main>
                </SidebarInset>
              </SidebarProvider>
            </DashboardProvider>
          </GlobalFiltersProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
