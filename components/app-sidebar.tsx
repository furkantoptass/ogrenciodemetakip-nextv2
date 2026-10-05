"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ban,
  CalendarDays,
  CalendarX,
  CirclePause,
  ClipboardList,
  Compass,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  MessageCircle,
  Phone,
  Plane,
  PlaneTakeoff,
  PlusSquare,
  RefreshCw,
  ShieldCheck,
  Table2,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ODT_NAV_GROUPS, ODT_MENU_ITEMS, odtNavActive } from "@/lib/odt-nav";

const ICONS: Record<string, LucideIcon> = {
  panel: LayoutDashboard,
  ucuslar: PlaneTakeoff,
  iptaller: Ban,
  askida: CirclePause,
  "odeme-takvimi": CalendarDays,
  geciken: CalendarX,
  filo: Warehouse,
  liste: Table2,
  ekstra: PlusSquare,
  "hat-ppl": Plane,
  "pic-takip": Compass,
  wapi: MessageCircle,
  formlar: ClipboardList,
  aramalar: Phone,
  seo: LineChart,
  super: ShieldCheck,
  naeron: RefreshCw,
};

export function AppSidebar({ modules }: { modules: string[] }) {
  const pathname = usePathname();
  const groups = ODT_NAV_GROUPS.map((group) => ({
    ...group,
    items: ODT_MENU_ITEMS.filter((item) => item.group === group.id && modules.includes(item.module ?? item.id)),
  })).filter((group) => group.items.length > 0);

  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />} tooltip="Northfly ODT">
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <GraduationCap className="size-4" aria-hidden="true" />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">Northfly ODT</span>
                <span className="truncate text-xs text-sidebar-foreground/70">Öğrenci takip sistemi</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = ICONS[item.id] ?? Table2;
                  const on = odtNavActive(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={on}
                        tooltip={item.label}
                        render={<Link href={item.href} aria-current={on ? "page" : undefined} />}
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <p className="px-2 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          Veri kaynağı: Naeron
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
