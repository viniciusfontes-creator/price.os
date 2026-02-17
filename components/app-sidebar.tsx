"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  DollarSign,
  Target,
  Package,
  BarChart3,
  Settings,
  ChevronDown,
  Calendar,
  AlertTriangle,
  Link as LinkIcon,
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

const menuItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Vendas",
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
      {
        title: "Alertas Críticos",
        href: "/inventory/abnormal",
        icon: AlertTriangle,
      },
    ],
  },
  {
    title: "Pricing & Mercado",
    href: "/pricing",
    icon: DollarSign,
  },
  {
    title: "Inteligência de Vendas",
    href: "/sales-demand",
    icon: BarChart3,
  },
  {
    title: "Análise de concorrentes - shortstay",
    href: "/concorrencia",
    icon: Package,
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

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="https://cdn.prod.website-files.com/63977cb1ecc6e0c28d964384/63977e3b4b25e34b04d3e541_QUARTO%20A%20VISTA%20PRINCIPAL.png"
            alt="Quarto a Vista"
            className="h-10 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">Quarto a Vista</span>
            <span className="text-xs text-muted-foreground">Performance Monitor</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) =>
                item.subItems ? (
                  <Collapsible key={item.href} defaultOpen={pathname.startsWith(item.href)}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={pathname.startsWith(item.href)}>
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
