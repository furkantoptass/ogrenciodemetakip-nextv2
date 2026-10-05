"use client";

import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, CircleAlert, Inbox, ListChecks, RefreshCw, Search } from "lucide-react";
import { PageHeader, PageShell } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type FormSatir = { formId: number; title: string; active: boolean; labels: Record<string, string> };
type Kayit = {
  entryId: number;
  formId: number;
  formTitle: string;
  date: string;
  ad: string;
  telefon: string;
  eposta: string;
  ozet: string;
  fields: Record<string, string>;
};

const SELECT_CLS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground";
const TABLE_WRAP =
  "max-h-[max(20rem,calc(100dvh-9rem))] min-w-0 overflow-auto rounded-xl bg-card ring-1 ring-foreground/10 [&_[data-slot=table-container]]:overflow-visible";
const TH_CLS = "h-9 bg-muted text-xs font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border)]";
const OK_BADGE = "border-emerald-500/50 text-emerald-700 dark:text-emerald-400";

function fmtGun(iso: string): string {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
  const d = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return d ? `${d[3]}.${d[2]}.${d[1]}` : iso || "—";
}

function StatCard({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <Card size="sm" className="gap-1">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="text-lg leading-tight font-semibold tabular-nums">{children}</div>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </CardContent>
    </Card>
  );
}

export default function FormlarPanel() {
  const [forms, setForms] = useState<FormSatir[]>([]);
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [kapali, setKapali] = useState(0);
  const [q, setQ] = useState("");
  const [formId, setFormId] = useState(0);
  const [openId, setOpenId] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cekNot, setCekNot] = useState("");
  const [listeAcik, setListeAcik] = useState(false);
  const [yuklendi, setYuklendi] = useState(false);

  const load = useCallback(async (search: string, fid: number) => {
    try {
      const res = await fetch(`/api/formlar?q=${encodeURIComponent(search)}&form=${fid || ""}`);
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error || "Okunamadı");
        return;
      }
      setErr("");
      setForms(data.forms ?? []);
      setKayitlar(data.kayitlar ?? []);
      setKapali(data.kapali ?? 0);
    } catch {
      setErr("Okunamadı");
    } finally {
      setYuklendi(true);
    }
  }, []);

  useEffect(() => {
    void load("", 0);
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load(q, formId);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, formId, load]);

  async function cek() {
    setBusy(true);
    setCekNot("Çekiliyor…");
    setErr("");
    let page = 1;
    let toplam = 0;
    try {
      for (;;) {
        const res = await fetch("/api/formlar/cek", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page }),
        });
        const data = await res.json();
        if (!data.ok) {
          setErr(data.error || "Çekilemedi");
          setCekNot("");
          return;
        }
        toplam += Number(data.n) || 0;
        setCekNot(`Yazıldı: ${toplam}`);
        if (page === 1) await load(q, formId);
        if (data.bitti) break;
        page += 1;
        if (page > 80) break;
      }
      setCekNot(`Bitti · ${toplam} kayıt`);
      await load(q, formId);
    } catch {
      setErr("Çekilemedi");
      setCekNot("");
    } finally {
      setBusy(false);
    }
  }

  async function acKapa(id: number, active: boolean) {
    try {
      const res = await fetch("/api/formlar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: id, active }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error || "Kaydedilemedi");
        return;
      }
      await load(q, formId);
    } catch {
      setErr("Kaydedilemedi");
    }
  }

  const acikForms = forms.filter((f) => f.active);

  return (
    <PageShell>
      <PageHeader title="Formlar" description="WordPress sitesindeki formlardan gelen başvuru ve iletişim kayıtları.">
        {cekNot ? <span className="text-sm text-muted-foreground tabular-nums" role="status">{cekNot}</span> : null}
        <Button type="button" disabled={busy} onClick={() => void cek()}>
          <RefreshCw className={cn(busy && "animate-spin")} aria-hidden />
          {busy ? "Çekiliyor…" : "WordPress’ten çek"}
        </Button>
      </PageHeader>

      {err ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{err}</AlertTitle>
          <AlertDescription>İşlem tamamlanamadı. Bağlantını kontrol edip tekrar dene.</AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="Özet göstergeler" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Form" hint="WordPress’ten çekilen">{forms.length}</StatCard>
        <StatCard label="Açık form" hint="Listede görünenler">{acikForms.length}</StatCard>
        <StatCard label="Kapalı form" hint="Listede gizli">{kapali}</StatCard>
        <StatCard label="Kayıt" hint="Bu filtreyle listelenen">{kayitlar.length}</StatCard>
      </section>

      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="frm-ara" className="text-xs text-muted-foreground">Ara</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="frm-ara"
                  type="search"
                  className="pl-8"
                  placeholder="Ad, telefon, e-posta…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="frm-form" className="text-xs text-muted-foreground">Form</Label>
              <select id="frm-form" className={SELECT_CLS} value={formId} onChange={(e) => setFormId(Number(e.target.value))}>
                <option value={0}>Açık formlar</option>
                {acikForms.map((f) => (
                  <option key={f.formId} value={f.formId}>
                    {f.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setListeAcik((v) => !v)}
              aria-expanded={listeAcik}
              aria-controls="frm-durum-panel"
              className="flex w-full items-center gap-2 rounded-md text-left text-sm font-medium outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ListChecks className="size-4 text-muted-foreground" aria-hidden />
              <span>Hangi formlar açık · {acikForms.length} açık, {forms.length - acikForms.length} kapalı</span>
              <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", listeAcik && "rotate-180")} aria-hidden />
            </button>
            <div id="frm-durum-panel" hidden={!listeAcik} className="pt-3">
              <p className="mb-3 text-sm text-muted-foreground">
                Son 1 ayda kayıt geldiyse açık, gelmediyse kapalı. Düğmeden elle değiştirebilirsin. Kapalı olanlar listede durmaz.
              </p>
              {forms.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz form yok. Önce WordPress’ten çek.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {forms.map((f) => (
                    <li key={f.formId} className="flex min-w-0 items-center gap-2 text-sm">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        aria-pressed={f.active}
                        aria-label={`${f.title}: ${f.active ? "açık, kapat" : "kapalı, aç"}`}
                        className={cn("w-14", f.active ? OK_BADGE : "text-muted-foreground")}
                        onClick={() => void acKapa(f.formId, !f.active)}
                      >
                        {f.active ? "Açık" : "Kapalı"}
                      </Button>
                      <span className={cn("min-w-0 truncate", !f.active && "text-muted-foreground")} title={f.title}>{f.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!yuklendi ? (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </CardContent>
        </Card>
      ) : acikForms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Inbox className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">{forms.length === 0 ? "Kayıt yok" : `Hepsi kapalı (${kapali} form)`}</p>
            <p className="text-sm text-muted-foreground">
              {forms.length === 0
                ? "Form kayıtlarını getirmek için “WordPress’ten çek” düğmesini kullan."
                : "Kayıtları görmek için yukarıdaki “Hangi formlar açık” bölümünden en az bir formu aç."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={TABLE_WRAP} role="region" aria-label="Form kayıtları" tabIndex={0}>
          <Table>
            <TableHeader className="sticky top-0 z-10 [&_tr]:border-b-0">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className={cn(TH_CLS, "w-8")}>
                  <span className="sr-only">Ayrıntı</span>
                </TableHead>
                <TableHead scope="col" className={TH_CLS}>Tarih</TableHead>
                <TableHead scope="col" className={TH_CLS}>Form</TableHead>
                <TableHead scope="col" className={TH_CLS}>Ad</TableHead>
                <TableHead scope="col" className={TH_CLS}>Telefon</TableHead>
                <TableHead scope="col" className={TH_CLS}>E-posta</TableHead>
                <TableHead scope="col" className={TH_CLS}>Not</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kayitlar.map((k) => {
                const on = openId === k.entryId;
                const form = forms.find((f) => f.formId === k.formId);
                return (
                  <Fragment key={k.entryId}>
                    <TableRow className="cursor-pointer" onClick={() => setOpenId(on ? 0 : k.entryId)}>
                      <TableCell className="align-top">
                        <button
                          type="button"
                          aria-expanded={on}
                          aria-label={`${k.ad || k.formTitle} kaydının ayrıntısını ${on ? "gizle" : "göster"}`}
                          className="flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <ChevronRight className={cn("size-4 transition-transform", on && "rotate-90")} aria-hidden />
                        </button>
                      </TableCell>
                      <TableCell className="align-top tabular-nums">{fmtGun(k.date)}</TableCell>
                      <TableCell className="max-w-56 align-top whitespace-normal">
                        <Badge variant="secondary" className="h-auto whitespace-normal">{k.formTitle}</Badge>
                      </TableCell>
                      <TableCell className="max-w-56 align-top font-medium whitespace-normal">{k.ad || "—"}</TableCell>
                      <TableCell className="align-top tabular-nums">{k.telefon || "—"}</TableCell>
                      <TableCell className="max-w-64 align-top break-all whitespace-normal">{k.eposta || "—"}</TableCell>
                      <TableCell className="max-w-md min-w-48 align-top whitespace-normal text-muted-foreground">
                        {k.ozet ? <span className="line-clamp-2 break-words">{k.ozet}</span> : "—"}
                      </TableCell>
                    </TableRow>
                    {on ? (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={7} className="border-l-2 border-l-primary/40 px-4 py-3 whitespace-normal">
                          {Object.keys(k.fields).length === 0 ? (
                            <p className="text-sm text-muted-foreground">Bu kayıtta başka alan yok.</p>
                          ) : (
                            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
                              {Object.entries(k.fields).map(([id, val]) => (
                                <div key={id} className="min-w-0">
                                  <dt className="text-xs text-muted-foreground">{form?.labels[id] || `Alan ${id}`}</dt>
                                  <dd className="m-0 text-sm">
                                    {String(val).startsWith("http") ? (
                                      <a
                                        className="rounded-sm break-all text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                                        href={String(val)}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {String(val)}
                                      </a>
                                    ) : (
                                      <span className="break-words whitespace-pre-wrap">{val || "—"}</span>
                                    )}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
              {kayitlar.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-10 text-center whitespace-normal text-muted-foreground">
                    <Inbox className="mx-auto mb-2 size-6" aria-hidden />
                    Bu açık formlarda kayıt yok. Aramayı veya form seçimini değiştirip tekrar dene.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </PageShell>
  );
}
