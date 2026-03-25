import type React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/mode-toggle"
import { GlobalFiltersProvider } from "@/contexts/global-filters-context"
import { DashboardProvider } from "@/contexts/dashboard-provider"
import { ViewContextProvider } from "@/contexts/view-context"
import { UserMenu } from "@/components/user-menu"
import { ViewSwitcher } from "@/components/view-switcher"
import { ViewGuard } from "@/components/view-guard"
import { GlobalPageHelp } from "@/components/global-page-help"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ViewContextProvider>
            <ViewGuard>
                <GlobalFiltersProvider>
                    <DashboardProvider>
                        <SidebarProvider>
                            <AppSidebar />
                            <SidebarInset>
                                <header className="relative z-50 flex h-14 bg-background items-center gap-4 border-b px-6">
                                    <SidebarTrigger />
                                    <ViewSwitcher />
                                    <div className="ml-auto flex items-center gap-4">
                                        <ModeToggle />
                                        <UserMenu />
                                    </div>
                                </header>
                                <main className="flex-1 p-6">{children}</main>
                            </SidebarInset>
                        </SidebarProvider>
                        <GlobalPageHelp />
                    </DashboardProvider>
                </GlobalFiltersProvider>
            </ViewGuard>
        </ViewContextProvider>
    )
}
