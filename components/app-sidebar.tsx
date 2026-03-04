"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  DollarSign,
  Target,
  Package,
  BarChart3,
  ChevronDown,
  Calendar,
  Link as LinkIcon,
  Building2,
  Calculator,
  GitCompare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useViewContext, type ViewType } from "@/contexts/view-context"
import type { LucideIcon } from "lucide-react"

// ============================================
// MENU ITEM TYPES
// ============================================

interface MenuItem {
  title: string
  href: string
  icon: LucideIcon
  subItems?: {
    title: string
    href: string
    icon: LucideIcon
  }[]
  // Which views this item appears in. If empty/undefined → all views
  views?: ViewType[]
}

// ============================================
// FULL MENU CONFIGURATION
// ============================================

const allMenuItems: MenuItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    // All views
  },
  {
    title: "Pace",
    href: "/vendas",
    icon: Target,
    subItems: [
      {
        title: "Vendas",
        href: "/vendas",
        icon: LayoutDashboard,
      },
      {
        title: "Disponibilidade",
        href: "/inventory/availability",
        icon: Calendar,
      },
    ],
    // All views
  },
  {
    title: "Gestão de Unidades",
    href: "/propriedades/pricing",
    icon: Building2,
    views: ["short-stay", "hotelaria"],
    subItems: [
      {
        title: "Pricing",
        href: "/propriedades/pricing",
        icon: DollarSign,
      },
      {
        title: "Gestão de Custos",
        href: "/propriedades/custos",
        icon: Calculator,
      },
      {
        title: "Racionalização",
        href: "/propriedades/racionalizacao",
        icon: GitCompare,
      },
    ],
  },
  {
    title: "Inteligência de Vendas",
    href: "/sales-demand",
    icon: BarChart3,
    views: ["short-stay", "hotelaria"],
  },
  {
    title: "Análise de Concorrentes",
    href: "/concorrencia",
    icon: Package,
    views: ["short-stay"],
    subItems: [
      {
        title: "Monitor de Mercado",
        href: "/concorrencia",
        icon: Target,
      },
      {
        title: "Correlação (Meus Anúncios)",
        href: "/correlacao",
        icon: LinkIcon,
      },
    ],
  },
]

// ============================================
// COMPONENT
// ============================================

export function AppSidebar() {
  const pathname = usePathname()
  const { currentView } = useViewContext()

  // Filter menu items based on current view
  const visibleItems = allMenuItems.filter((item) => {
    if (!item.views) return true // No restriction → show in all views
    if (!currentView) return true // No view selected → show all
    return item.views.includes(currentView)
  })

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="https://cdn.prod.website-files.com/63977cb1ecc6e0c28d964384/63977e3b4b25e34b04d3e541_QUARTO%20A%20VISTA%20PRINCIPAL.png"
            alt="Price.OS"
            className="h-10 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">Price.OS</span>
            <span className="text-xs text-muted-foreground">Performance Monitor</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) =>
                item.subItems ? (
                  <Collapsible
                    key={item.href}
                    defaultOpen={
                      pathname === item.href ||
                      item.subItems.some((sub) => pathname === sub.href) ||
                      item.subItems.some((sub) => pathname.startsWith(sub.href))
                    }
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          isActive={
                            pathname === item.href ||
                            item.subItems.some((sub) => pathname === sub.href) ||
                            item.subItems.some((sub) => pathname.startsWith(sub.href))
                          }
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.subItems.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.href}>
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
                                <Link href={subItem.href}>
                                  <subItem.icon className="h-4 w-4" />
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
