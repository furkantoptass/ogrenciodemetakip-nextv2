"use client";

import { useEffect, useRef, useState } from "react";
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
  Braces,
  LineChart,
  LogOut,
  MessageCircle,
  Phone,
  Plane,
  PlaneTakeoff,
  PlusSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ODT_MENU_ITEMS, odtNavActive } from "@/lib/odt-nav";
import { cn } from "@/lib/utils";

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
  paylasim: Braces,
};

type Hit = {
  kind: "ogrenci" | "ogretmen";
  id: number;
  name: string;
  extra: string;
  href: string | null;
};

function KisiArama() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setHits([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/arama?q=${encodeURIComponent(t)}`, { signal: ctrl.signal });
        const data = await res.json();
        setHits(data.ok ? data.results ?? [] : []);
      } catch {
        if (!ctrl.signal.aborted) setHits([]);
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, 200);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function goHit(href: string | null) {
    setOpen(false);
    setQ("");
    setHits([]);
    if (href) window.location.assign(href);
  }

  const showHits = open && q.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative w-36 sm:w-52">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Öğrenci veya öğretmen ara…"
        autoComplete="off"
        aria-label="Kişi ara"
        className="h-8 pl-8"
      />
      {showHits ? (
        <div
          role="listbox"
          aria-label="Arama sonuçları"
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {busy && hits.length === 0 ? <p className="px-2 py-1.5 text-sm text-muted-foreground">Aranıyor…</p> : null}
          {!busy && hits.length === 0 ? <p className="px-2 py-1.5 text-sm text-muted-foreground">Sonuç yok</p> : null}
          {hits.map((h) => (
            <button
              key={`${h.kind}-${h.id}`}
              type="button"
              role="option"
              aria-selected="false"
              disabled={!h.href}
              onClick={() => goHit(h.href)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none disabled:opacity-60"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{h.name}</span>
                {h.extra ? <span className="block truncate text-xs text-muted-foreground">{h.extra}</span> : null}
              </span>
              <Badge variant={h.kind === "ogrenci" ? "secondary" : "outline"}>
                {h.kind === "ogrenci" ? "Öğrenci" : "Öğretmen"}
              </Badge>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AppHeader({
  email,
  name,
  canSearch,
  modules,
}: {
  email: string;
  name: string;
  canSearch: boolean;
  modules: string[];
}) {
  const pathname = usePathname();
  const initials = (name || email).trim().slice(0, 2).toLocaleUpperCase("tr");
  const navRef = useRef<HTMLElement>(null);
  const items = ODT_MENU_ITEMS.filter((item) => modules.includes(item.module ?? item.id));

  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>("[aria-current='page']");
    if (!nav || !current) return;
    const left = current.offsetLeft;
    const right = left + current.offsetWidth;
    if (left < nav.scrollLeft) nav.scrollLeft = left;
    else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth;
  }, [pathname]);

  return (
    <header className="print:hidden sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Link href="/" className="flex shrink-0 items-center gap-2 pr-1">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <GraduationCap className="size-3.5" aria-hidden="true" />
        </span>
        <span className="hidden text-sm font-semibold sm:inline">Northfly ODT</span>
      </Link>
      <nav ref={navRef} aria-label="Sayfalar" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {items.map((item) => {
          const Icon = ICONS[item.id] ?? Table2;
          const on = odtNavActive(pathname, item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                on && "bg-accent font-medium text-accent-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span>{item.short}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        {canSearch ? <KisiArama /> : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="sm" className="gap-2 px-1.5" aria-label="Hesap menüsü" />}
          >
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-40 truncate text-sm md:inline">{name || email}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="block truncate font-medium text-foreground">{name || "Hesap"}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">{email}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<a href="/auth/signout" />}>
              <LogOut aria-hidden="true" />
              Çıkış yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
