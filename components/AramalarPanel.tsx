"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CircleAlert, LoaderCircle, Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing } from "lucide-react";
import { PageHeader, PageShell } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Row = {
  call_uuid: string;
  start_stamp: string;
  direction: string;
  caller_id_number: string;
  destination_number: string;
  duration: string;
  result: string;
  missed: boolean;
  recording_present: boolean;
};

type Ozet = { toplam: number; gelen: number; giden: number; kacan: number };

const SELECT_CLS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground";
const TABLE_WRAP =
  "max-h-[max(20rem,calc(100dvh-9rem))] min-w-0 overflow-auto rounded-xl bg-card ring-1 ring-foreground/10 [&_[data-slot=table-container]]:overflow-visible";
const TH_CLS = "h-9 bg-muted text-xs font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border)]";

function istanbulBugun(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function yonOzet(direction: string): "gelen" | "giden" | "dahili" | "diger" {
  const d = direction.toLowerCase();
  if (d.includes("inbound") || d.includes("gelen")) return "gelen";
  if (d.includes("outbound") || d.includes("giden")) return "giden";
  if (d.includes("internal") || d.includes("dahili")) return "dahili";
  return "diger";
}

function yonYazi(d: string): string {
  const y = yonOzet(d);
  if (y === "gelen") return "Gelen";
  if (y === "giden") return "Giden";
  if (y === "dahili") return "Dahili";
  return d || "—";
}

function gunSaat(iso: string): string {
  const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2}).*?(\d{2}):(\d{2})/);
  if (m) return `${m[3]}.${m[2]} ${m[4]}:${m[5]}`;
  return iso || "—";
}

function YonRozet({ direction }: { direction: string }) {
  const y = yonOzet(direction);
  if (y === "diger" && !direction) return <span className="text-muted-foreground/50">—</span>;
  const Icon = y === "gelen" ? PhoneIncoming : y === "giden" ? PhoneOutgoing : Phone;
  return (
    <Badge variant={y === "gelen" ? "secondary" : "outline"}>
      <Icon aria-hidden />
      {yonYazi(direction)}
    </Badge>
  );
}

function StatCard({
  label,
  hint,
  tone = "default",
  children,
}: {
  label: string;
  hint?: string;
  tone?: "default" | "destructive";
  children: ReactNode;
}) {
  return (
    <Card size="sm" className="gap-1">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={cn("text-lg leading-tight font-semibold tabular-nums", tone === "destructive" && "text-destructive")}>
          {children}
        </div>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </CardContent>
    </Card>
  );
}

export default function AramalarPanel() {
  const bugun = istanbulBugun();
  const [from, setFrom] = useState(bugun);
  const [to, setTo] = useState(bugun);
  const [direction, setDirection] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [ozet, setOzet] = useState<Ozet>({ toplam: 0, gelen: 0, giden: 0, kacan: 0 });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let live = true;
    setBusy(true);
    setErr("");
    const qs = new URLSearchParams({ from, to });
    if (direction) qs.set("direction", direction);
    void (async () => {
      try {
        const res = await fetch(`/api/verimor/cdrs?${qs.toString()}`, { signal: ac.signal });
        const data = await res.json();
        if (!live) return;
        if (!data.ok) {
          setErr(data.error || "Okunamadı");
          setRows([]);
          setOzet({ toplam: 0, gelen: 0, giden: 0, kacan: 0 });
          return;
        }
        setRows(data.rows ?? []);
        setOzet(data.ozet ?? { toplam: 0, gelen: 0, giden: 0, kacan: 0 });
      } catch (e) {
        if (!live) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setErr("Okunamadı");
        setRows([]);
      } finally {
        if (live) setBusy(false);
      }
    })();
    return () => {
      live = false;
      ac.abort();
    };
  }, [from, to, direction]);

  return (
    <PageShell>
      <PageHeader title="Aramalar" description="Verimor santralinden okunan arama kayıtları.">
        {busy ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Yükleniyor…
          </span>
        ) : null}
      </PageHeader>

      <Card size="sm">
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-2xl">
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="arm-baslangic" className="text-xs text-muted-foreground">Başlangıç</Label>
              <Input
                id="arm-baslangic"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value || istanbulBugun())}
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="arm-bitis" className="text-xs text-muted-foreground">Bitiş</Label>
              <Input
                id="arm-bitis"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value || istanbulBugun())}
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="arm-yon" className="text-xs text-muted-foreground">Yön</Label>
              <select id="arm-yon" value={direction} onChange={(e) => setDirection(e.target.value)} className={SELECT_CLS}>
                <option value="">Hepsi</option>
                <option value="inbound">Gelen</option>
                <option value="outbound">Giden</option>
                <option value="internal">Dahili</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {err ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{err}</AlertTitle>
          <AlertDescription>Arama kayıtları alınamadı. Tarih aralığını daraltıp tekrar dene; sürerse Verimor bağlantı ayarlarını kontrol et.</AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="Özet göstergeler" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Toplam" hint="Seçili aralıkta">{ozet.toplam}</StatCard>
        <StatCard label="Gelen">{ozet.gelen}</StatCard>
        <StatCard label="Giden">{ozet.giden}</StatCard>
        <StatCard label="Kaçan" tone={ozet.kacan > 0 ? "destructive" : "default"}>{ozet.kacan}</StatCard>
      </section>

      {err ? null : busy && rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <PhoneOff className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Bu aralıkta arama yok</p>
            <p className="text-sm text-muted-foreground">Tarih aralığını genişletip veya yön filtresini “Hepsi” yapıp tekrar dene.</p>
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(TABLE_WRAP, busy && "opacity-60")}
          role="region"
          aria-label="Arama kayıtları"
          aria-busy={busy}
          tabIndex={0}
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 [&_tr]:border-b-0">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className={TH_CLS}>Tarih</TableHead>
                <TableHead scope="col" className={TH_CLS}>Yön</TableHead>
                <TableHead scope="col" className={TH_CLS}>Arayan</TableHead>
                <TableHead scope="col" className={TH_CLS}>Aranan</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "text-right")}>Süre</TableHead>
                <TableHead scope="col" className={TH_CLS}>Sonuç</TableHead>
                <TableHead scope="col" className={TH_CLS}>Kayıt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.call_uuid}>
                  <TableCell className="tabular-nums">{gunSaat(r.start_stamp)}</TableCell>
                  <TableCell>
                    <YonRozet direction={r.direction} />
                  </TableCell>
                  <TableCell className="tabular-nums">{r.caller_id_number || "—"}</TableCell>
                  <TableCell className="tabular-nums">{r.destination_number || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.duration || "—"}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal">
                    {r.missed ? (
                      <Badge variant="destructive">
                        <PhoneMissed aria-hidden />
                        {r.result || "Kaçan"}
                      </Badge>
                    ) : r.result ? (
                      <Badge variant="outline">{r.result}</Badge>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.recording_present ? (
                      <Badge variant="secondary">Var</Badge>
                    ) : (
                      <span className="text-muted-foreground">Yok</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageShell>
  );
}
