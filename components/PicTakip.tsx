"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, CircleAlert, Loader2, Search, SearchX, X } from "lucide-react";
import { fmtMoneyEu } from "@/lib/hesaplamalar";
import { picFmtMin, type PicTakipPageData, type PicTakipRow, type PicUcus } from "@/lib/pic-takip";
import { PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const GRID_COLSPAN = 10;

const TH_CLS =
  "h-auto bg-muted px-2 py-1.5 align-bottom text-[11px] leading-tight font-medium tracking-wide whitespace-normal text-muted-foreground uppercase shadow-[inset_0_-1px_0_var(--color-border)]";
const TD_CLS = "px-2 py-1.5 align-top";
const NUM_CLS = "px-2 py-1.5 text-right align-top tabular-nums";

type MoneyAny = { currencyID: number; sum_price?: number; sum_payed?: number; sum_schedule?: number };

type SaveState = "saving" | "ok" | "err";

type ModalState = {
  title: string;
  name: string;
  grouped: boolean;
  days?: Array<{ date: string; flights: PicUcus[] }>;
  flights?: PicUcus[];
};

function Dash() {
  return <span className="text-muted-foreground/50">—</span>;
}

function MoneyLines({
  rows,
  field,
  symbolMap,
}: {
  rows: MoneyAny[];
  field: "price" | "payed" | "schedule";
  symbolMap: Record<number, string>;
}) {
  const parts: string[] = [];
  for (const r of rows) {
    const n = field === "price" ? (r.sum_price ?? 0) : field === "payed" ? (r.sum_payed ?? 0) : (r.sum_schedule ?? 0);
    const sym = symbolMap[r.currencyID] ?? "¤";
    if (Math.abs(n) >= 1e-6 || sym !== "¤") parts.push(`${fmtMoneyEu(n)} ${sym}`);
  }
  if (!parts.length) return <Dash />;
  return (
    <>
      {parts.map((p, i) => (
        <span key={i} className="block whitespace-nowrap">
          {p}
        </span>
      ))}
    </>
  );
}

function fullName(row: PicTakipRow): string {
  return `${row.firstName} ${row.lastName}`.trim();
}

function KpiCard({
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

function FlightsButton({ count, label, onClick }: { count: number; label: string; onClick: () => void }) {
  if (!count) return <Dash />;
  return (
    <Button type="button" variant="ghost" size="xs" className="tabular-nums" aria-label={label} title={label} onClick={onClick}>
      <Check className="text-emerald-700 dark:text-emerald-400" aria-hidden />
      {count}
    </Button>
  );
}

function FlightRow({ flight }: { flight: PicUcus }) {
  return (
    <TableRow>
      <TableCell className="px-3 py-1.5 tabular-nums">{flight.date}</TableCell>
      <TableCell className="px-3 py-1.5 whitespace-normal">{flight.route || "—"}</TableCell>
      <TableCell className="px-3 py-1.5 text-right tabular-nums">{picFmtMin(flight.minutes)}</TableCell>
    </TableRow>
  );
}

export default function PicTakip({ data }: { data: PicTakipPageData }) {
  const [q, setQ] = useState("");
  const [saveState, setSaveState] = useState<Record<number, SaveState>>({});
  const [modal, setModal] = useState<ModalState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [savedDates, setSavedDates] = useState<Record<number, string>>({});

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data.rows;
    return data.rows.filter((r) => {
      const blob = `${r.firstName} ${r.lastName} ${r.shortCode ?? ""}`.toLowerCase();
      return blob.includes(t);
    });
  }, [data.rows, q]);

  const totalDoneMin = useMemo(() => data.rows.reduce((a, r) => a + r.doneMin, 0), [data.rows]);
  const behindCount = useMemo(() => data.rows.filter((r) => r.paidBehind).length, [data.rows]);

  function openModal(next: ModalState) {
    setModal(next);
    setModalOpen(true);
  }

  async function saveDates(studentId: number, value: string) {
    const row = data.rows.find((r) => r.mId === studentId);
    const current = savedDates[studentId] ?? row?.datesText;
    if (row && value === current) {
      setSaveState((m) => {
        const next = { ...m };
        delete next[studentId];
        return next;
      });
      return;
    }
    setSaveState((m) => ({ ...m, [studentId]: "saving" }));
    try {
      const res = await fetch("/api/pic-takip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, dates: value }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Kaydedilemedi");
      setSavedDates((m) => ({ ...m, [studentId]: value }));
      setSaveState((m) => ({ ...m, [studentId]: "ok" }));
    } catch {
      setSaveState((m) => ({ ...m, [studentId]: "err" }));
    }
  }

  const modalFlightCount = modal
    ? modal.grouped
      ? (modal.days ?? []).reduce((a, d) => a + d.flights.length, 0)
      : (modal.flights ?? []).length
    : 0;

  return (
    <PageShell>
      <PageHeader
        title="PIC Takip"
        description={
          <>
            PIC eğitimi olan öğrencilerin uçuş, ödeme ve meydan durumu · gösterilen öğrenci:{" "}
            <strong className="font-semibold text-foreground tabular-nums">{rows.length}</strong>
            {rows.length !== data.rows.length ? <span className="tabular-nums"> / {data.rows.length}</span> : null}
          </>
        }
      />

      <section aria-label="Özet göstergeler" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Öğrenci" hint="PIC eğitimi olan">
          {data.rows.length}
        </KpiCard>
        <KpiCard label="Toplam anlaşma" hint="Planlanan PIC süresi (saat:dk)">
          {picFmtMin(data.totalPlanMin)}
        </KpiCard>
        <KpiCard label="Yapılan uçuş" hint="Gerçekleşen PIC süresi (saat:dk)">
          {picFmtMin(totalDoneMin)}
        </KpiCard>
        <KpiCard label="Kalan" hint="Anlaşma − yapılan uçuş (saat:dk)">
          {picFmtMin(data.totalRemainMin)}
        </KpiCard>
        <KpiCard
          label="Ödemesi geciken öğrenci"
          hint="Vadesi gelmiş tutar ödenenden fazla"
          tone={behindCount > 0 ? "destructive" : "default"}
        >
          {behindCount}
        </KpiCard>
      </section>

      <Card size="sm">
        <CardContent>
          <div role="search" className="relative md:max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ara: ad, soyad, kısa kod…"
              aria-label="Öğrenci ara"
              autoComplete="off"
            />
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <SearchX className="size-8 text-muted-foreground" aria-hidden />
            {data.rows.length === 0 ? (
              <>
                <p className="font-medium">PIC eğitimi olan öğrenci yok</p>
                <p className="text-sm text-muted-foreground">PIC eğitimi tanımlanan öğrenciler burada listelenir.</p>
              </>
            ) : (
              <>
                <p className="font-medium">Öğrenci bulunamadı</p>
                <p className="text-sm text-muted-foreground">Aramayı değiştirip yeniden deneyin.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setQ("")}>
                  Aramayı temizle
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div
          className="max-h-[calc(100dvh-9rem)] min-w-0 overflow-auto rounded-xl bg-card ring-1 ring-foreground/10 [contain:inline-size] print:max-h-none print:overflow-visible [&_[data-slot=table-container]]:overflow-visible"
          role="region"
          aria-label="PIC takip listesi"
          tabIndex={0}
        >
          <Table className="min-w-[1080px] text-xs">
            <TableHeader className="sticky top-0 z-10 [&_tr]:border-b-0">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className={cn(TH_CLS, "min-w-44")}>Öğrenci</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "border-l text-right")}>Toplam anlaşma</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "text-right")}>Yapılan uçuş</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "text-right")}>Kalan</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "border-l text-right")}>Sözleşme bedeli</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "text-right")}>Ödeme planı</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "text-right")}>Yapılan ödeme</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "min-w-48 border-l")}>Katılacağı tarihler</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "border-l text-center")}>3 meydan</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "text-center")}>Dış meydan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const name = fullName(row);
                const state = saveState[row.mId];
                const statusId = `pic-dates-status-${row.mId}`;
                return (
                  <TableRow key={row.mId}>
                    <TableCell className={cn(TD_CLS, "whitespace-normal")}>
                      <span className="font-medium">{name}</span>
                      {row.shortCode ? <div className="mt-0.5 text-[11px] text-muted-foreground">{row.shortCode}</div> : null}
                      {row.paidBehind ? (
                        <div className="mt-1">
                          <Badge variant="destructive">
                            <CircleAlert aria-hidden />
                            Gecikmiş
                          </Badge>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className={cn(NUM_CLS, "border-l")}>{picFmtMin(row.planMin)}</TableCell>
                    <TableCell
                      className={cn(
                        NUM_CLS,
                        row.planMin > 0 && row.doneMin >= row.planMin && "font-semibold text-emerald-700 dark:text-emerald-400"
                      )}
                    >
                      {picFmtMin(row.doneMin)}
                    </TableCell>
                    <TableCell className={NUM_CLS}>{picFmtMin(row.remainMin)}</TableCell>
                    <TableCell className={cn(NUM_CLS, "border-l")}>
                      <MoneyLines rows={row.money} field="price" symbolMap={data.symbolMap} />
                    </TableCell>
                    <TableCell className={NUM_CLS}>
                      <MoneyLines rows={row.scheduleTotal} field="schedule" symbolMap={data.symbolMap} />
                    </TableCell>
                    <TableCell className={cn(NUM_CLS, row.paidBehind && "font-semibold text-destructive")}>
                      <MoneyLines rows={row.money} field="payed" symbolMap={data.symbolMap} />
                    </TableCell>
                    <TableCell className={cn(TD_CLS, "border-l whitespace-normal")}>
                      <Input
                        type="text"
                        className="h-7 min-w-40 text-xs md:text-xs"
                        defaultValue={savedDates[row.mId] ?? row.datesText}
                        onBlur={(e) => void saveDates(row.mId, e.target.value)}
                        placeholder="Tarih yazın"
                        aria-label={`${name} için katılacağı tarihler`}
                        aria-invalid={state === "err" || undefined}
                        aria-describedby={state ? statusId : undefined}
                      />
                      {state ? (
                        <div
                          id={statusId}
                          role="status"
                          className={cn(
                            "mt-1 flex items-center gap-1 text-[11px] text-muted-foreground",
                            state === "ok" && "text-emerald-700 dark:text-emerald-400",
                            state === "err" && "font-medium text-destructive"
                          )}
                        >
                          {state === "saving" ? (
                            <>
                              <Loader2 className="size-3 animate-spin" aria-hidden />
                              Kaydediliyor…
                            </>
                          ) : state === "ok" ? (
                            <>
                              <Check className="size-3" aria-hidden />
                              Kaydedildi
                            </>
                          ) : (
                            <>
                              <CircleAlert className="size-3 shrink-0" aria-hidden />
                              Kaydedilemedi. Alana tıklayıp çıkarak yeniden deneyin.
                            </>
                          )}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className={cn(TD_CLS, "border-l text-center")}>
                      <FlightsButton
                        count={row.ucMeydan.length}
                        label={`${name}: 3 meydan uçuşlarını göster (${row.ucMeydan.length} gün)`}
                        onClick={() => openModal({ title: "3 meydan", name, grouped: true, days: row.ucMeydan })}
                      />
                    </TableCell>
                    <TableCell className={cn(TD_CLS, "text-center")}>
                      <FlightsButton
                        count={row.disMeydan.length}
                        label={`${name}: dış meydan uçuşlarını göster (${row.disMeydan.length} uçuş)`}
                        onClick={() => openModal({ title: "Dış meydan", name, grouped: false, flights: row.disMeydan })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="row" className="h-auto px-2 py-1.5 align-top text-xs font-semibold">
                  TOPLAM
                </TableHead>
                <TableCell className={cn(NUM_CLS, "border-l")}>{picFmtMin(data.totalPlanMin)}</TableCell>
                <TableCell className={TD_CLS}></TableCell>
                <TableCell className={NUM_CLS}>{picFmtMin(data.totalRemainMin)}</TableCell>
                <TableCell colSpan={GRID_COLSPAN - 4} className={cn(TD_CLS, "border-l")}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-2xl">
          <DialogHeader className="pr-9">
            <DialogTitle>{modal ? `${modal.title} — ${modal.name}` : ""}</DialogTitle>
            <DialogDescription>
              {modal?.grouped
                ? `${(modal.days ?? []).length} gün · ${modalFlightCount} uçuş`
                : `${modalFlightCount} uçuş`}
            </DialogDescription>
          </DialogHeader>
          <DialogClose render={<Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" aria-label="Kapat" />}>
            <X aria-hidden />
          </DialogClose>
          <div className="max-h-[60dvh] overflow-auto rounded-lg border [&_[data-slot=table-container]]:overflow-visible">
            <Table className="text-xs">
              <TableHeader className="sticky top-0 z-10 [&_tr]:border-b-0">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className={cn(TH_CLS, "px-3")}>Tarih</TableHead>
                  <TableHead scope="col" className={cn(TH_CLS, "px-3")}>Rota</TableHead>
                  <TableHead scope="col" className={cn(TH_CLS, "px-3 text-right")}>Süre</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modal && modalFlightCount === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      Gösterilecek uçuş yok.
                    </TableCell>
                  </TableRow>
                ) : null}
                {modal?.grouped
                  ? (modal.days ?? []).flatMap((day) => [
                      <TableRow key={`${day.date}-h`} className="bg-muted/50 hover:bg-muted/50">
                        <TableHead scope="colgroup" colSpan={3} className="h-auto px-3 py-1.5 text-xs font-semibold tabular-nums">
                          {day.date} · {day.flights.length} uçuş
                        </TableHead>
                      </TableRow>,
                      ...day.flights.map((f, i) => <FlightRow key={`${day.date}-${i}`} flight={f} />),
                    ])
                  : (modal?.flights ?? []).map((f, i) => <FlightRow key={i} flight={f} />)}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
