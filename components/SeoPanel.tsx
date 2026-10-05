"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CloudDownload,
  ExternalLink,
  FileMinus2,
  FilePlus2,
  Loader2,
  RefreshCw,
  Search,
  SearchX,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageShell } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Row = {
  id: number;
  link: string;
  title: string;
  score: number | null;
  keyword: string;
  seoTitle: string;
  description: string;
};

type Ozet = {
  gun: string | null;
  adet: number;
  ortalama: number | null;
  zayif: number;
  orta: number;
  iyi: number;
  puanYukselen: number;
  puanDusen: number;
  yeni: number;
  cikan: number;
};

type Madde = { title: string; link: string; ne: string };
type Gun = { gun: string; maddeler: Madde[] };
type Kind = "posts" | "pages";
type Ton = "default" | "zayif" | "orta" | "iyi";

const sayi = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

const TON_CLS: Record<Ton, string> = {
  default: "",
  zayif: "text-destructive",
  orta: "text-amber-700 dark:text-amber-400",
  iyi: "text-emerald-700 dark:text-emerald-400",
};

const TH_CLS = "h-9 bg-muted px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase";

function istanbulBugun(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function kaydir(ymd: string, gun: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + gun);
  return dt.toISOString().slice(0, 10);
}

function fmtGun(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ymd;
}

function puanTon(score: number | null): Ton {
  if (score == null) return "default";
  if (score < 40) return "zayif";
  if (score < 70) return "orta";
  return "iyi";
}

// Geçmiş özetiyle aynı bantlar: puansız satır zayıf sayılır.
function anlikOzet(rows: Row[]) {
  let toplam = 0;
  let say = 0;
  let zayif = 0;
  let orta = 0;
  let iyi = 0;
  for (const r of rows) {
    if (r.score == null) {
      zayif += 1;
      continue;
    }
    toplam += r.score;
    say += 1;
    if (r.score < 40) zayif += 1;
    else if (r.score < 70) orta += 1;
    else iyi += 1;
  }
  return { adet: rows.length, ortalama: say ? Math.round((toplam / say) * 10) / 10 : null, zayif, orta, iyi };
}

function PuanRozet({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Puan yok</span>
      </span>
    );
  }
  const ton = puanTon(score);
  const etiket = ton === "zayif" ? "Zayıf" : ton === "orta" ? "Orta" : "İyi";
  return (
    <Badge
      variant={ton === "zayif" ? "destructive" : "outline"}
      title={etiket}
      className={cn(
        "min-w-9 tabular-nums",
        ton === "orta" && "border-amber-500/50 text-amber-700 dark:text-amber-400",
        ton === "iyi" && "border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
      )}
    >
      {score}
      <span className="sr-only"> ({etiket})</span>
    </Badge>
  );
}

function Stat({
  title,
  value,
  hint,
  ton = "default",
  icon: Icon,
}: {
  title: string;
  value: string;
  hint?: string;
  ton?: Ton;
  icon?: typeof TrendingUp;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        {Icon ? (
          <CardAction>
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-semibold tabular-nums", TON_CLS[ton])}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function Hata({ mesaj }: { mesaj: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>Veri alınamadı</AlertTitle>
      <AlertDescription>{mesaj}</AlertDescription>
    </Alert>
  );
}

export default function SeoPanel() {
  const bugun = istanbulBugun();
  const [sekme, setSekme] = useState<"simdi" | "gecmis">("simdi");
  const [kind, setKind] = useState<Kind>("posts");
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cekNot, setCekNot] = useState("");

  const [from, setFrom] = useState(() => kaydir(bugun, -30));
  const [to, setTo] = useState(bugun);
  const [ozet, setOzet] = useState<Ozet | null>(null);
  const [gunler, setGunler] = useState<Gun[]>([]);
  const [kayitGunleri, setKayitGunleri] = useState<string[]>([]);
  const [gecmisBusy, setGecmisBusy] = useState(false);
  const [gecmisErr, setGecmisErr] = useState("");

  const load = useCallback(async (k: Kind) => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/seo?kind=${k}`);
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error || "SEO verisi okunamadı. Biraz sonra Yenile ile tekrar deneyin.");
        setRows([]);
        return;
      }
      setRows(data.rows ?? []);
    } catch {
      setErr("SEO verisi okunamadı. Bağlantınızı kontrol edip Yenile ile tekrar deneyin.");
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, []);

  const loadGecmis = useCallback(async (k: Kind, f: string, t: string) => {
    setGecmisBusy(true);
    setGecmisErr("");
    try {
      const qs = new URLSearchParams({ kind: k, from: f, to: t });
      const res = await fetch(`/api/seo/tarihce?${qs.toString()}`);
      const data = await res.json();
      if (!data.ok) {
        setGecmisErr(data.error || "Geçmiş kayıtlar okunamadı. Tarih aralığını değiştirip tekrar deneyin.");
        setOzet(null);
        setGunler([]);
        setKayitGunleri([]);
        return;
      }
      setOzet(data.ozet ?? null);
      setGunler(data.gunler ?? []);
      setKayitGunleri(data.kayitGunleri ?? []);
    } catch {
      setGecmisErr("Geçmiş kayıtlar okunamadı. Bağlantınızı kontrol edip tekrar deneyin.");
      setOzet(null);
      setGunler([]);
      setKayitGunleri([]);
    } finally {
      setGecmisBusy(false);
    }
  }, []);

  useEffect(() => {
    if (sekme === "simdi") void load(kind);
  }, [sekme, kind, load]);

  useEffect(() => {
    if (sekme === "gecmis") void loadGecmis(kind, from, to);
  }, [sekme, kind, from, to, loadGecmis]);

  async function cek() {
    setBusy(true);
    setCekNot("Çekiliyor…");
    setErr("");
    try {
      const res = await fetch("/api/seo/cek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yalnizYoksa: false }),
      });
      const data = await res.json();
      if (!data.ok) {
        const mesaj = data.error || "SEO verisi çekilemedi. Biraz sonra tekrar deneyin.";
        setErr(mesaj);
        setCekNot("");
        toast.error(mesaj);
        return;
      }
      const n = Number(data.postsN || 0) + Number(data.pagesN || 0);
      setCekNot(`Kaydedildi · ${n} satır`);
      toast.success(`Günlük kayıt alındı: ${n} satır.`);
      await load(kind);
    } catch {
      const mesaj = "SEO verisi çekilemedi. Bağlantınızı kontrol edip tekrar deneyin.";
      setErr(mesaj);
      setCekNot("");
      toast.error(mesaj);
    } finally {
      setBusy(false);
    }
  }

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter(
        (r) =>
          r.title.toLowerCase().includes(needle) ||
          r.keyword.toLowerCase().includes(needle) ||
          r.seoTitle.toLowerCase().includes(needle)
      )
    : rows;
  const anlik = anlikOzet(rows);
  const kindAd = kind === "posts" ? "yazı" : "sayfa";
  const sutun = kind === "posts" ? 5 : 3;
  const cekiliyor = cekNot === "Çekiliyor…";
  // İlk yüklemede sıfır yerine çizgi göster.
  const adet = (n: number) => (busy && rows.length === 0 ? "—" : sayi.format(n));

  return (
    <PageShell>
      <PageHeader title="SEO" description="Sitedeki yazı ve sayfaların Rank Math puanları, odak kelimeleri ve günlük değişimi.">
        {sekme === "simdi" ? (
          <>
            <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {cekNot}
            </span>
            <Button variant="outline" disabled={busy} onClick={() => void load(kind)}>
              <RefreshCw className={busy && !cekiliyor ? "animate-spin" : ""} aria-hidden="true" />
              {busy && !cekiliyor ? "Bakılıyor…" : "Yenile"}
            </Button>
            <Button disabled={busy} onClick={() => void cek()}>
              <CloudDownload className={cekiliyor ? "animate-pulse" : ""} aria-hidden="true" />
              {cekiliyor ? "Çekiliyor…" : "Şimdi çek"}
            </Button>
          </>
        ) : null}
      </PageHeader>

      <Tabs
        value={sekme}
        onValueChange={(v) => {
          if (v === "gecmis") {
            setSekme("gecmis");
            setGecmisBusy(true);
          } else {
            setSekme("simdi");
          }
        }}
        className="min-w-0 gap-4"
      >
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <TabsList aria-label="Görünüm">
            <TabsTrigger value="simdi" className="px-3">
              Şimdi
            </TabsTrigger>
            <TabsTrigger value="gecmis" className="px-3">
              Geçmiş
            </TabsTrigger>
          </TabsList>

          <div role="group" aria-label="İçerik türü" className="inline-flex h-8 items-center gap-0.5 rounded-lg bg-muted p-[3px]">
            {(
              [
                ["posts", "Yazılar"],
                ["pages", "Sayfalar"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant="ghost"
                aria-pressed={kind === id}
                onClick={() => setKind(id)}
                className={cn(
                  "h-full px-3 text-sm text-foreground/60",
                  kind === id && "bg-background text-foreground shadow-sm hover:bg-background"
                )}
              >
                {label}
              </Button>
            ))}
          </div>

          {sekme === "gecmis" ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label htmlFor="seo-from" className="text-xs text-muted-foreground">
                  Başlangıç
                </Label>
                <Input
                  id="seo-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value || kaydir(bugun, -30))}
                  className="w-40"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="seo-to" className="text-xs text-muted-foreground">
                  Bitiş
                </Label>
                <Input
                  id="seo-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value || bugun)}
                  className="w-40"
                />
              </div>
              {gecmisBusy ? (
                <span className="flex h-8 items-center gap-1.5 text-sm text-muted-foreground" role="status">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Yükleniyor…
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <TabsContent value="simdi" className="flex min-w-0 flex-col gap-4">
          {err ? <Hata mesaj={err} /> : null}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            <Stat title={kind === "posts" ? "Toplam yazı" : "Toplam sayfa"} value={adet(anlik.adet)} hint="Sitede yayımlanan içerik" />
            <Stat
              title="Ortalama puan"
              value={anlik.ortalama == null ? "—" : sayi.format(anlik.ortalama)}
              hint="Puanı olan satırlar"
              ton={puanTon(anlik.ortalama)}
            />
            <Stat title="Zayıf" value={adet(anlik.zayif)} hint="40 altı veya puansız" ton="zayif" />
            <Stat title="Orta" value={adet(anlik.orta)} hint="40–69 arası" ton="orta" />
            <Stat title="İyi" value={adet(anlik.iyi)} hint="70 ve üzeri" ton="iyi" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1 md:max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                className="pl-8"
                placeholder="Başlık veya kelime…"
                aria-label="Başlık, odak kelime veya SEO başlığında ara"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <span className="text-sm tabular-nums text-muted-foreground" role="status">
              {busy ? "" : `${shown.length} satır`}
            </span>
          </div>

          <div
            className="max-h-[calc(100dvh-12rem)] min-w-0 overflow-auto rounded-xl bg-card ring-1 ring-foreground/10 [contain:inline-size] [&_[data-slot=table-container]]:overflow-visible"
            role="region"
            aria-label={kind === "posts" ? "Yazıların SEO listesi" : "Sayfaların SEO listesi"}
            tabIndex={0}
          >
            <Table className={kind === "posts" ? "min-w-[960px]" : "min-w-[560px]"}>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className={cn(TH_CLS, "w-16 text-right")}>
                    Puan
                  </TableHead>
                  <TableHead scope="col" className={TH_CLS}>
                    Odak kelime
                  </TableHead>
                  <TableHead scope="col" className={TH_CLS}>
                    Başlık
                  </TableHead>
                  {kind === "posts" ? (
                    <TableHead scope="col" className={TH_CLS}>
                      SEO başlığı
                    </TableHead>
                  ) : null}
                  {kind === "posts" ? (
                    <TableHead scope="col" className={TH_CLS}>
                      Açıklama
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="px-3 text-right align-top">
                      <PuanRozet score={r.score} />
                    </TableCell>
                    <TableCell className="max-w-56 px-3 align-top whitespace-normal">{r.keyword || "—"}</TableCell>
                    <TableCell className="max-w-80 px-3 align-top whitespace-normal">
                      <a
                        className="inline-flex items-start gap-1 font-medium text-primary underline-offset-4 hover:underline"
                        href={r.link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="break-words">{r.title || r.link}</span>
                        <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-60" aria-hidden="true" />
                        <span className="sr-only">(yeni sekmede açılır)</span>
                      </a>
                    </TableCell>
                    {kind === "posts" ? (
                      <TableCell className="max-w-72 px-3 align-top whitespace-normal">{r.seoTitle || "—"}</TableCell>
                    ) : null}
                    {kind === "posts" ? (
                      <TableCell className="max-w-md px-3 align-top whitespace-normal text-muted-foreground">
                        {r.description || "—"}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
                {busy && shown.length === 0
                  ? Array.from({ length: 6 }, (_, i) => (
                      <TableRow key={`bos-${i}`} className="hover:bg-transparent">
                        <TableCell colSpan={sutun} className="px-3">
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
                {!busy && shown.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={sutun} className="whitespace-normal">
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
                        <p className="font-medium">Satır yok</p>
                        <p className="text-sm text-muted-foreground">
                          {needle
                            ? "Aramaya uyan satır bulunamadı. Arama metnini kısaltın veya temizleyin."
                            : err
                              ? "Liste alınamadı. Yenile ile tekrar deneyin."
                              : `Sitede listelenecek ${kindAd} bulunamadı.`}
                        </p>
                        {needle ? (
                          <Button variant="outline" size="sm" onClick={() => setQ("")}>
                            Aramayı temizle
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="gecmis" className="flex min-w-0 flex-col gap-4">
          {gecmisErr ? <Hata mesaj={gecmisErr} /> : null}
          {ozet && kayitGunleri.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
                <Stat
                  title="Son kayıt"
                  value={ozet.gun ? fmtGun(ozet.gun) : "—"}
                  hint={`${sayi.format(ozet.adet)} satır`}
                />
                <Stat
                  title="Ortalama puan"
                  value={ozet.ortalama == null ? "—" : sayi.format(ozet.ortalama)}
                  hint="Son kayıttaki puanlı satırlar"
                  ton={puanTon(ozet.ortalama)}
                />
                <Stat title="Zayıf" value={sayi.format(ozet.zayif)} hint="40 altı veya puansız" ton="zayif" />
                <Stat title="Orta" value={sayi.format(ozet.orta)} hint="40–69 arası" ton="orta" />
                <Stat title="İyi" value={sayi.format(ozet.iyi)} hint="70 ve üzeri" ton="iyi" />
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat title="Yükselen" value={sayi.format(ozet.puanYukselen)} icon={TrendingUp} />
                <Stat title="Düşen" value={sayi.format(ozet.puanDusen)} icon={TrendingDown} />
                <Stat title="Yeni" value={sayi.format(ozet.yeni)} icon={FilePlus2} />
                <Stat title="Çıkan" value={sayi.format(ozet.cikan)} icon={FileMinus2} />
              </div>

              {gunler.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    Bu aralıkta değişen satır yok.
                  </CardContent>
                </Card>
              ) : (
                gunler.map((g) => (
                  <Card key={g.gun}>
                    <CardHeader className="border-b">
                      <CardTitle className="tabular-nums">
                        <h2>{fmtGun(g.gun)}</h2>
                      </CardTitle>
                      <CardAction>
                        <Badge variant="secondary" className="tabular-nums">
                          {g.maddeler.length} değişiklik
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <ul className="divide-y">
                        {g.maddeler.map((m, i) => (
                          <li key={`${g.gun}-${i}`} className="py-2 text-sm first:pt-0 last:pb-0">
                            {m.link ? (
                              <a
                                className="font-medium text-primary underline-offset-4 hover:underline"
                                href={m.link}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {m.title}
                              </a>
                            ) : (
                              <span className="font-medium">{m.title}</span>
                            )}
                            <span className="text-muted-foreground"> — {m.ne}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))
              )}
            </>
          ) : !gecmisBusy ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="font-medium">Bu aralıkta kayıt yok</p>
                <p className="text-sm text-muted-foreground">
                  Tarih aralığını genişletin veya Şimdi sekmesinden bir kez “Şimdi çek” ile kayıt alın.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
