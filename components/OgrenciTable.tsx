"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  CircleAlert,
  Clock,
  FilterX,
  Search,
  SearchX,
  StickyNote,
  Tags,
  TriangleAlert,
} from "lucide-react";
import type { OgrenciRow, CurrencyInfo } from "@/lib/ogrenci";
import { ODT_DEFAULT_ACTIVE_CORP_IDS } from "@/lib/ogrenci";
import {
  fmtMinutes,
  fmtMoneyEu,
  fmtMoneyDec,
  extraBilledEur,
  labelTextColor,
  overdueRemainingFromPlanAndPaid,
} from "@/lib/hesaplamalar";
import type { OgrenciDetayData } from "@/lib/ogrenci-detay";
import OgrenciDetay from "@/components/OgrenciDetay";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const GRID_COLSPAN = 20;

type FilterData = {
  fleets: Array<{ m_ID: number; name: string }>;
  facilities: Array<{ m_ID: number; name: string }>;
  corpLabels: Array<{ m_ID: number; name: string; color: string }>;
  groups: Array<{ m_ID: number; code: string; fleet_name: string }>;
};

type CurrentFilters = {
  fleet?: number;
  facility?: string;
  group?: string;
  student?: number;
  corp?: number[];
  corpFormSubmitted?: boolean;
  search?: string;
  grad?: boolean;
  susp?: boolean;
  excludePplGrad?: boolean;
};

type Modes = { errMode: boolean; overdueOnly: boolean; noteMode: boolean };

type Props = {
  initialRows: OgrenciRow[];
  filters: FilterData;
  currencies: CurrencyInfo[];
  symbolMap: Record<number, string>;
  corpCounts: Record<number, number>;
  studentDropdown: Array<{ m_ID: number; label: string }>;
  currentFilters: CurrentFilters;
  modes: Modes;
  detay: OgrenciDetayData | null;
};

const TRAINING_GROUPS = [
  { id: "ppl_a", label: "PPL(A)", names: ["PPL(A)", "PPL"], extra: true },
  { id: "pic", label: "PIC", names: ["PIC"], extra: false },
  { id: "nvfr", label: "NVFR", names: ["NR", "Nvfr", "NVFR"], extra: false },
];
const RATING_BITS = [
  { id: "cpl" as const, label: "CPL" },
  { id: "ir" as const, label: "IR" },
  { id: "me" as const, label: "ME" },
  { id: "atpl" as const, label: "ATPL theory" },
];

const SELECT_CLS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground";
const CHECK_CLS = "size-4 shrink-0 rounded border-input accent-primary";
const TH_CLS =
  "h-auto bg-muted px-2 py-1.5 align-bottom text-[11px] leading-tight font-medium tracking-wide whitespace-normal text-muted-foreground uppercase shadow-[inset_0_-1px_0_var(--color-border)]";
const TD_CLS = "px-2 py-1.5 align-top";
const NUM_CLS = "px-2 py-1.5 text-right align-top tabular-nums";
const GROUP_EDGE = "border-l";

function mergeMinutes(trainings: Record<string, { plan: number; done: number }>, names: string[]) {
  let plan = 0, done = 0;
  for (const n of names) { plan += trainings[n]?.plan ?? 0; done += trainings[n]?.done ?? 0; }
  return { plan, done };
}

type MoneyAny = { currencyID: number; sum_price?: number; sum_payed?: number; sum_schedule?: number; sum_plan?: number };
type MoneyField = "price" | "payed" | "schedule" | "plan";

function moneyVal(r: MoneyAny, field: MoneyField): number {
  return field === "price" ? (r.sum_price ?? 0) : field === "payed" ? (r.sum_payed ?? 0) : field === "schedule" ? (r.sum_schedule ?? 0) : (r.sum_plan ?? 0);
}

function sumByCurrency(
  rows: OgrenciRow[],
  pick: (row: OgrenciRow) => MoneyAny[],
  field: MoneyField
): MoneyAny[] {
  const by: Record<number, number> = {};
  for (const row of rows) {
    for (const r of pick(row)) {
      const cid = r.currencyID;
      if (!cid) continue;
      by[cid] = (by[cid] ?? 0) + moneyVal(r, field);
    }
  }
  return Object.entries(by)
    .map(([currencyID, n]) => ({
      currencyID: Number(currencyID),
      sum_price: n,
      sum_payed: n,
      sum_schedule: n,
      sum_plan: n,
    }))
    .filter((r) => Math.abs(moneyVal(r, field)) >= 1e-6);
}

const MONEY_EQ_TOL = 1;

function extraSAmount(row: OgrenciRow): number {
  let n = 0;
  for (const r of row.moneyExtra) n += r.sum_price ?? 0;
  return n;
}

function extraSPlusPaidCoversDue(row: OgrenciRow): boolean {
  const extra: Record<number, number> = {};
  const paid: Record<number, number> = {};
  const due: Record<number, number> = {};
  for (const r of row.moneyExtra) {
    const cid = r.currencyID;
    if (cid) extra[cid] = (extra[cid] ?? 0) + (r.sum_price ?? 0);
  }
  for (const r of row.money) {
    const cid = r.currencyID;
    if (cid) paid[cid] = (paid[cid] ?? 0) + (r.sum_payed ?? 0);
  }
  for (const r of row.planDue) {
    const cid = r.currencyID;
    if (cid) due[cid] = (due[cid] ?? 0) + (r.sum_plan ?? 0);
  }
  const dueCids = Object.keys(due).map(Number).filter((cid) => (due[cid] ?? 0) > MONEY_EQ_TOL);
  if (!dueCids.length) return false;
  for (const cid of dueCids) {
    if ((extra[cid] ?? 0) + (paid[cid] ?? 0) + MONEY_EQ_TOL < (due[cid] ?? 0)) return false;
  }
  return true;
}

function extraURed(row: OgrenciRow, extraBill: number | null): boolean {
  const extraS = extraSAmount(row);
  const extraU = extraBill ?? 0;
  return Math.abs(extraS - extraU) > MONEY_EQ_TOL;
}

function fmtNoteDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function formatNoteLine(body: string, author: string | null, at: string | null): string {
  const text = body.replace(/\s+/g, " ").trim();
  const ts = fmtNoteDay(at);
  const who = (author ?? "").trim();
  const prefix = ts ? `${ts}${who ? ` · ${who}: ` : ": "}` : (who ? `${who}: ` : "");
  return prefix + text;
}

function fleetAbbrev(name: string | null): string {
  if (!name) return "";
  const m = name.match(/^(\d+)/);
  return m ? m[1] : name.slice(0, 8);
}

function Dash() {
  return <span className="text-muted-foreground/50">—</span>;
}

function ListNoteRow({
  studentId,
  studentName,
  visible,
  initialBody,
  initialAuthor,
  initialAt,
}: {
  studentId: number;
  studentName: string;
  visible: boolean;
  initialBody: string | null;
  initialAuthor: string | null;
  initialAt: string | null;
}) {
  const [body, setBody] = useState(initialBody);
  const [author, setAuthor] = useState(initialAuthor);
  const [at, setAt] = useState(initialAt);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasNote = !!(body && body.trim());

  async function add() {
    const text = draft.trim();
    if (!text) {
      setMsg("Not boş olamaz.");
      setMsgErr(true);
      return;
    }
    setBusy(true);
    setMsg("Kaydediliyor…");
    setMsgErr(false);
    try {
      const res = await fetch("/api/ogrenciler/notlar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, body: text }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.error || "Kaydedilemedi");
        setMsgErr(true);
        return;
      }
      setBody(text);
      setAuthor(data.note?.authorName ?? author);
      setAt(data.note?.createdAt ?? new Date().toISOString());
      setDraft("");
      setMsg("");
    } catch {
      setMsg("Kaydedilemedi");
      setMsgErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow
      className={cn("bg-muted/40 hover:bg-muted/40 print:hidden", !visible && "hidden")}
      data-student-id={studentId}
    >
      <TableCell colSpan={GRID_COLSPAN} className="border-l-2 border-l-primary/40 px-3 py-2 whitespace-normal">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-2">
            <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground">NOT</span>
            {hasNote ? (
              <span className="min-w-0 break-words">{formatNoteLine(body ?? "", author, at)}</span>
            ) : (
              <span className="text-muted-foreground">Henüz not yok</span>
            )}
          </div>
          <div className="flex max-w-3xl flex-wrap items-center gap-2 pl-5.5">
            <Input
              type="text"
              className="h-7 min-w-48 flex-1 text-xs md:text-xs"
              maxLength={4000}
              placeholder="Yeni not ekle…"
              aria-label={`${studentName} için yeni not`}
              value={draft}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add();
                }
              }}
            />
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void add()}>
              Ekle
            </Button>
            {msg ? (
              <span className={cn("text-xs", msgErr ? "font-medium text-destructive" : "text-muted-foreground")} role="status">
                {msg}
              </span>
            ) : null}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function moneyParts(rows: MoneyAny[], field: MoneyField, symbolMap: Record<number, string>): string[] {
  const parts: string[] = [];
  for (const r of rows) {
    const n = moneyVal(r, field);
    const sym = symbolMap[r.currencyID] ?? "¤";
    if (Math.abs(n) >= 1e-6 || sym !== "¤") parts.push(`${fmtMoneyEu(n)} ${sym}`);
  }
  return parts;
}

function MoneyLines({ rows, field, symbolMap }: {
  rows: MoneyAny[];
  field: MoneyField;
  symbolMap: Record<number, string>;
}) {
  const parts = moneyParts(rows, field, symbolMap);
  if (!parts.length) return <Dash />;
  return <>{parts.map((p, i) => <span key={i} className="block whitespace-nowrap">{p}</span>)}</>;
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
  children: React.ReactNode;
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

function KpiMoney({ parts }: { parts: string[] }) {
  if (!parts.length) return <Dash />;
  return <>{parts.map((p, i) => <span key={i} className="block whitespace-nowrap">{p}</span>)}</>;
}

function KeepFields({
  currentFilters,
  modes,
  except = [],
}: {
  currentFilters: CurrentFilters;
  modes: Modes;
  except?: string[];
}) {
  const skip = new Set(except);
  const fields: Array<{ name: string; value: string }> = [];
  const add = (name: string, value: string | number | undefined | null) => {
    if (skip.has(name) || value === undefined || value === null || value === "" || value === 0) return;
    fields.push({ name, value: String(value) });
  };
  add("q", currentFilters.search);
  add("fleet", currentFilters.fleet);
  add("facility", currentFilters.facility);
  add("group", currentFilters.group);
  add("student", currentFilters.student);
  if (currentFilters.grad) add("grad", "1");
  if (currentFilters.susp === false) add("susp", "0");
  if (currentFilters.excludePplGrad) add("exclude_ppl_grad", "1");
  if (modes.errMode) add("err_mode", "1");
  if (modes.overdueOnly) add("overdue_only", "1");
  if (modes.noteMode) add("note_mode", "1");
  if (currentFilters.corpFormSubmitted && !skip.has("corp")) {
    fields.push({ name: "corp_form", value: "1" });
    for (const id of currentFilters.corp ?? []) fields.push({ name: "corp", value: String(id) });
  }
  return (
    <>
      {fields.map((f, i) => (
        <input key={`${f.name}-${f.value}-${i}`} type="hidden" name={f.name} value={f.value} />
      ))}
    </>
  );
}

export default function OgrenciTable({ initialRows, filters, symbolMap, corpCounts, studentDropdown, currentFilters, modes, detay }: Props) {
  const [corpFormOpen, setCorpFormOpen] = useState(!!currentFilters.corpFormSubmitted);
  const [selectedCorp, setSelectedCorp] = useState<number[]>(currentFilters.corp ?? ODT_DEFAULT_ACTIVE_CORP_IDS);
  const [noteModeOn, setNoteModeOn] = useState(modes.noteMode);
  const modesNow: Modes = { ...modes, noteMode: noteModeOn };

  useEffect(() => {
    const u = new URL(window.location.href);
    if (noteModeOn) u.searchParams.set("note_mode", "1");
    else u.searchParams.delete("note_mode");
    const qs = u.searchParams.toString();
    window.history.replaceState(null, "", u.pathname + (qs ? `?${qs}` : "") + u.hash);
  }, [noteModeOn]);

  const rows = initialRows;
  const totals = {
    moneyPrice: sumByCurrency(rows, (r) => r.money, "price"),
    moneyExtra: sumByCurrency(rows, (r) => r.moneyExtra, "price"),
    schedule: sumByCurrency(rows, (r) => r.scheduleTotal, "schedule"),
    planDue: sumByCurrency(rows, (r) => r.planDue, "plan"),
    moneyPayed: sumByCurrency(rows, (r) => r.money, "payed"),
    extraBill: rows.reduce((acc, r) => acc + (extraBilledEur(r.pplExtraMinutes) ?? 0), 0),
    pplExtraMinutes: rows.reduce((acc, r) => acc + r.pplExtraMinutes, 0),
    training: TRAINING_GROUPS.map((g) => {
      let plan = 0;
      let done = 0;
      for (const row of rows) {
        const m = mergeMinutes(row.trainings, g.names);
        plan += m.plan;
        done += m.done;
      }
      return { id: g.id, extra: g.extra, plan, done };
    }),
  };

  const overdueBy: Record<number, number> = {};
  for (const row of rows) {
    for (const o of overdueRemainingFromPlanAndPaid(row.planDue, row.money)) {
      overdueBy[o.currencyID] = (overdueBy[o.currencyID] ?? 0) + o.remaining;
    }
  }
  const overdueParts = Object.entries(overdueBy).map(
    ([cid, n]) => `${fmtMoneyEu(n)} ${symbolMap[Number(cid)] ?? "¤"}`
  );
  const behindCount = rows.filter((r) => r.paidBehind).length;
  const mismatchCount = rows.filter((r) => r.hasInstallMismatch).length;

  function buildUrl(overrides: Record<string, string | string[] | null | boolean | number>) {
    const sp = new URLSearchParams();
    const merged: Record<string, unknown> = {
      fleet: currentFilters.fleet,
      facility: currentFilters.facility,
      group: currentFilters.group,
      student: currentFilters.student,
      q: currentFilters.search,
      grad: currentFilters.grad ? "1" : null,
      susp: currentFilters.susp === false ? "0" : null,
      exclude_ppl_grad: currentFilters.excludePplGrad ? "1" : null,
      err_mode: modes.errMode ? "1" : null,
      overdue_only: modes.overdueOnly ? "1" : null,
      note_mode: noteModeOn ? "1" : null,
      corp_form: currentFilters.corpFormSubmitted ? "1" : null,
      corp: currentFilters.corpFormSubmitted ? (currentFilters.corp ?? []) : null,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v === null || v === undefined || v === "" || v === 0) continue;
      if (Array.isArray(v)) { for (const item of v) sp.append(k, String(item)); }
      else sp.set(k, String(v));
    }
    return `/ogrenciler?${sp.toString()}`;
  }

  function getRowClass(row: OgrenciRow): string {
    const overdue = modes.overdueOnly && row.paidBehind;
    const err = modes.errMode && row.hasInstallMismatch;
    if (overdue && err) return "bg-orange-500/15 hover:bg-orange-500/20";
    if (overdue) return "bg-destructive/10 hover:bg-destructive/15";
    if (err) return "bg-amber-500/15 hover:bg-amber-500/20";
    return "";
  }

  const activeCount = selectedCorp.length;
  const advancedActive = !!(currentFilters.fleet || currentFilters.facility || currentFilters.group || currentFilters.student || currentFilters.grad || !currentFilters.susp);
  const corpSummary =
    currentFilters.corpFormSubmitted && (currentFilters.corp?.length ?? 0) === 0
      ? "Kurumsal etiketler · kapalı (tüm öğrenciler)"
      : `Kurumsal etiketler · ${activeCount} seçili (VEYA)`;
  const modeBtn = (on: boolean) => buttonVariants({ variant: on ? "default" : "outline", size: "sm" });

  return (
    <div className="flex min-w-0 flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {currentFilters.student ? (
            <a
              href={buildUrl({ student: null })}
              className="inline-flex w-fit items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 print:hidden"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Listeye dön
            </a>
          ) : null}
          <h1 className="text-xl font-semibold tracking-tight">Öğrenciler</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>
              Eğitim / sözleşme özeti · gösterilen öğrenci:{" "}
              <strong className="font-semibold text-foreground tabular-nums">{rows.length}</strong>
            </span>
            {modes.errMode && <Badge variant="outline">Hata vurgulama açık</Badge>}
            {modes.overdueOnly && <Badge variant="destructive">Vadesi geçmiş vurgulama açık</Badge>}
            {noteModeOn && <Badge variant="secondary">Not modu açık</Badge>}
          </p>
        </div>
        <div role="group" aria-label="Liste modları" className="flex flex-wrap items-center gap-2 print:hidden">
          <Button
            type="button"
            size="sm"
            variant={noteModeOn ? "default" : "outline"}
            aria-pressed={noteModeOn}
            title="Listedeki her öğrencinin son notunu satır altında gösterir. Tekrar tıklayınca kapanır."
            onClick={() => setNoteModeOn((v) => !v)}
          >
            <StickyNote aria-hidden />
            Not modu
          </Button>
          <a
            href={buildUrl({ err_mode: modes.errMode ? null : "1" })}
            className={modeBtn(modes.errMode)}
            aria-current={modes.errMode ? "true" : undefined}
            title="Sözleşme bedeli ile ödeme planı uyuşmayan satırları vurgular. Listeyi süzmez; yalnızca vurgular."
          >
            <TriangleAlert aria-hidden />
            Hata modu
          </a>
          <a
            href={buildUrl({ overdue_only: modes.overdueOnly ? null : "1" })}
            className={modeBtn(modes.overdueOnly)}
            aria-current={modes.overdueOnly ? "true" : undefined}
            title="Vadesi gelmiş tutarı ödenenden fazla olanları vurgular. Listeyi süzmez; yalnızca vurgular."
          >
            <Clock aria-hidden />
            Vadesi geçmiş
          </a>
        </div>
      </header>

      {!currentFilters.student && (
        <section aria-label="Özet göstergeler" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard label="Öğrenci" hint="Listelenen kayıt">{rows.length}</KpiCard>
          <KpiCard label="Toplam sözleşme" hint="İptal olmayan sözleşmeler">
            <KpiMoney parts={moneyParts(totals.moneyPrice, "price", symbolMap)} />
          </KpiCard>
          <KpiCard label="Tahsil edilen" hint="Ödenen toplam">
            <KpiMoney parts={moneyParts(totals.moneyPayed, "payed", symbolMap)} />
          </KpiCard>
          <KpiCard label="Vadesi geçmiş bakiye" hint="Vadesi gelmiş − ödenen" tone={overdueParts.length ? "destructive" : "default"}>
            <KpiMoney parts={overdueParts} />
          </KpiCard>
          <KpiCard
            label="Gecikmesi olan öğrenci"
            hint={`${mismatchCount} plan / sözleşme uyuşmazlığı`}
            tone={behindCount > 0 ? "destructive" : "default"}
          >
            {behindCount}
          </KpiCard>
        </section>
      )}

      <Card size="sm" className="print:hidden">
        <CardContent className="flex flex-col gap-3">
          <form method="get" action="/ogrenciler" role="search" className="flex flex-wrap items-center gap-2">
            <KeepFields currentFilters={currentFilters} modes={modesNow} except={["q"]} />
            <div className="relative min-w-56 flex-1 md:max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                name="q"
                className="pl-8"
                placeholder="Ara: kısa kod, ad, soyad, tel…"
                aria-label="Öğrenci ara"
                defaultValue={currentFilters.search ?? ""}
                autoComplete="off"
              />
            </div>
            <Button type="submit" size="default">Ara</Button>
            {advancedActive && <Badge variant="secondary">Gelişmiş filtre seçili</Badge>}
          </form>

          <form method="get" action="/ogrenciler" className="flex flex-col gap-3 border-t pt-3">
            <KeepFields currentFilters={currentFilters} modes={modesNow} except={["fleet", "facility", "group", "student", "grad", "susp", "exclude_ppl_grad"]} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="flt-fleet" className="text-xs text-muted-foreground">Filo</Label>
                <select id="flt-fleet" name="fleet" className={SELECT_CLS} defaultValue={String(currentFilters.fleet ?? "")}>
                  <option value="">(tümü)</option>
                  {filters.fleets.map((f) => <option key={f.m_ID} value={f.m_ID}>{f.name}</option>)}
                </select>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="flt-facility" className="text-xs text-muted-foreground">Tesis</Label>
                <select id="flt-facility" name="facility" className={SELECT_CLS} defaultValue={currentFilters.facility ?? ""}>
                  <option value="">(tümü)</option>
                  {filters.facilities.map((f) => <option key={f.m_ID} value={f.m_ID}>{f.name}</option>)}
                </select>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="flt-group" className="text-xs text-muted-foreground">Grup</Label>
                <select id="flt-group" name="group" className={SELECT_CLS} defaultValue={currentFilters.group ?? ""}>
                  <option value="">(tümü)</option>
                  {filters.groups.map((g) => <option key={g.m_ID} value={g.m_ID}>{g.fleet_name ? `${g.fleet_name} — ${g.code}` : g.code}</option>)}
                </select>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="flt-student" className="text-xs text-muted-foreground">Öğrenci</Label>
                <select id="flt-student" name="student" className={SELECT_CLS} defaultValue={String(currentFilters.student ?? "")}>
                  <option value="">(tümü)</option>
                  {studentDropdown.map((s) => <option key={s.m_ID} value={s.m_ID}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Label className="font-normal">
                <input type="checkbox" name="grad" value="1" className={CHECK_CLS} defaultChecked={!!currentFilters.grad} />
                Mezunları göster
              </Label>
              <Label className="font-normal">
                <input type="hidden" name="susp" value="0" />
                <input type="checkbox" name="susp" value="1" className={CHECK_CLS} defaultChecked={currentFilters.susp !== false} />
                Uçuşu askıya alınanlar
              </Label>
              <Label className="font-normal">
                <input type="checkbox" name="exclude_ppl_grad" value="1" className={CHECK_CLS} defaultChecked={!!currentFilters.excludePplGrad} />
                PPL mezunlarını listeden çıkar
              </Label>
              <div className="ml-auto flex items-center gap-2">
                <a href="/ogrenciler?corp_form=1" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  <FilterX aria-hidden />
                  Tümünü temizle
                </a>
                <Button type="submit" size="sm">Uygula</Button>
              </div>
            </div>
          </form>

          <div className="border-t pt-3">
            <button
              type="button"
              aria-expanded={corpFormOpen}
              aria-controls="odt-corp-panel"
              onClick={() => setCorpFormOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-md text-left text-sm font-medium outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Tags className="size-4 text-muted-foreground" aria-hidden />
              <span>{corpSummary}</span>
              <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", corpFormOpen && "rotate-180")} aria-hidden />
            </button>
            <div id="odt-corp-panel" hidden={!corpFormOpen} className="pt-3">
              <form method="get" action="/ogrenciler" className="flex flex-col gap-3">
                <KeepFields currentFilters={currentFilters} modes={modesNow} except={["corp"]} />
                <input type="hidden" name="corp_form" value="1" />
                <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <label className="flex min-w-0 cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      name="corp"
                      value="-1"
                      className={CHECK_CLS}
                      checked={selectedCorp.includes(-1)}
                      onChange={(e) => {
                        setSelectedCorp((prev) => e.target.checked ? [...prev, -1] : prev.filter((x) => x !== -1));
                      }}
                    />
                    <span className="truncate rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground">Etiketsiz</span>
                  </label>
                  {filters.corpLabels.map((cl) => (
                    <label key={cl.m_ID} className="flex min-w-0 cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        name="corp"
                        value={cl.m_ID}
                        className={CHECK_CLS}
                        checked={selectedCorp.includes(cl.m_ID)}
                        onChange={(e) => {
                          setSelectedCorp((prev) => e.target.checked ? [...prev, cl.m_ID] : prev.filter((x) => x !== cl.m_ID));
                        }}
                      />
                      <span
                        className="truncate rounded-md px-2 py-0.5 font-medium"
                        style={{ background: cl.color, color: labelTextColor(cl.color) }}
                      >
                        {cl.name}
                        {corpCounts[cl.m_ID] ? <span className="ml-1.5 font-normal opacity-70">{corpCounts[cl.m_ID]}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" size="sm">Etiketlerle filtrele</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedCorp([])}>Tümünü kaldır</Button>
                  {currentFilters.corpFormSubmitted && (
                    <a href="/ogrenciler" className={buttonVariants({ variant: "link", size: "sm" })}>
                      Naeron varsayılan etiketlerine dön
                    </a>
                  )}
                </div>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <SearchX className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Öğrenci bulunamadı</p>
            <p className="text-sm text-muted-foreground">Arama veya filtreleri değiştirip yeniden deneyin.</p>
            <a href="/ogrenciler?corp_form=1" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <FilterX aria-hidden />
              Filtreleri temizle
            </a>
          </CardContent>
        </Card>
      ) : (
        <div
          className="max-h-[calc(100dvh-9rem)] min-w-0 overflow-auto rounded-xl bg-card ring-1 ring-foreground/10 [contain:inline-size] print:max-h-none print:overflow-visible [&_[data-slot=table-container]]:overflow-visible"
          role="region"
          aria-label="Öğrenci listesi"
          tabIndex={0}
        >
          <Table id="odt-export-grid" className="min-w-[1360px] text-xs">
            <TableHeader className="sticky top-0 z-10 [&_tr]:border-b-0">
              <TableRow className="hover:bg-transparent">
                <TableHead rowSpan={2} scope="col" className={cn(TH_CLS, "w-8 text-right")}>#</TableHead>
                <TableHead rowSpan={2} scope="col" className={cn(TH_CLS, "min-w-44")}>Ad Soyad</TableHead>
                <TableHead rowSpan={2} scope="col" className={TH_CLS} title="İptal olmayan sözleşmeler">Sözleşme</TableHead>
                <TableHead rowSpan={2} scope="col" className={TH_CLS} title="Extra sözleşmeler">Extra-S</TableHead>
                <TableHead rowSpan={2} scope="col" className={cn(TH_CLS, GROUP_EDGE, "text-right")} title="İptal olmayan sözleşmelerin toplam sözleşme bedeli (price)">Toplam sözleşme bedeli</TableHead>
                <TableHead rowSpan={2} scope="col" className={cn(TH_CLS, "text-right")} title="Aktif taksit satırlarının tüm vadeler toplamı">Toplam ödeme planı</TableHead>
                <TableHead rowSpan={2} scope="col" className={cn(TH_CLS, "text-right")} title="Bugüne kadar gelmiş aktif taksit satırları toplamı">Bugün itibarıyla vadesi gelmiş</TableHead>
                <TableHead rowSpan={2} scope="col" className={cn(TH_CLS, "text-right")} title="İptal olmayan sözleşmelerin payed toplamı">Ödenen</TableHead>
                <TableHead rowSpan={2} scope="col" className={cn(TH_CLS, "text-right")} title="Ücretli extra uçuş süresi × 500 €/saat">Extra-U</TableHead>
                {TRAINING_GROUPS.map((g) => (
                  <TableHead key={g.id} colSpan={g.extra ? 3 : 2} scope="colgroup" className={cn(TH_CLS, GROUP_EDGE, "text-center shadow-none")}>{g.label}</TableHead>
                ))}
                {RATING_BITS.map((b, i) => (
                  <TableHead key={b.id} rowSpan={2} scope="col" className={cn(TH_CLS, "text-center", i === 0 && GROUP_EDGE)}>{b.label}</TableHead>
                ))}
              </TableRow>
              <TableRow className="hover:bg-transparent">
                {TRAINING_GROUPS.map((g) => (
                  <React.Fragment key={g.id}>
                    <TableHead scope="col" className={cn(TH_CLS, GROUP_EDGE, "text-right")}>Plan</TableHead>
                    <TableHead scope="col" className={cn(TH_CLS, "text-right")}>Uç</TableHead>
                    {g.extra && <TableHead scope="col" className={cn(TH_CLS, "text-right")} title="paidFlight=1 gerçekleşmiş uçuşlar, tüm zaman">Extra</TableHead>}
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => {
                const rowClass = getRowClass(row);
                const extraBill = extraBilledEur(row.pplExtraMinutes);
                const extrasCoverDue = extraSPlusPaidCoversDue(row);
                const paidRed = row.paidBehind && !extrasCoverDue;
                const extraUWarn = extraURed(row, extraBill);
                const showMismatch = modes.errMode && row.hasInstallMismatch;
                return (
                  <React.Fragment key={row.mId}>
                    <TableRow className={rowClass}>
                      <TableCell className={cn(NUM_CLS, "text-muted-foreground")}>{idx + 1}</TableCell>

                      <TableCell className={cn(TD_CLS, "whitespace-normal")}>
                        <a
                          href={`?student=${row.mId}`}
                          className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {row.firstName} <span className="font-semibold uppercase">{row.lastName}</span>
                        </a>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {row.corpLabelColor ? (
                            <Badge style={{ background: row.corpLabelColor, color: labelTextColor(row.corpLabelColor) }}>
                              {row.corpLabelName}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-muted-foreground">Etiketsiz</Badge>
                          )}
                          {row.fleetName && (
                            <Badge variant="outline" title={row.fleetName} className="tabular-nums">
                              {fleetAbbrev(row.fleetName)}
                            </Badge>
                          )}
                          {paidRed && (
                            <Badge variant="destructive">
                              <CircleAlert aria-hidden />
                              Gecikmiş
                            </Badge>
                          )}
                          {showMismatch && (
                            <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
                              <TriangleAlert aria-hidden />
                              Plan uyuşmuyor
                            </Badge>
                          )}
                        </div>
                        {row.shortCode && <div className="mt-0.5 text-[11px] text-muted-foreground">{row.shortCode}</div>}
                      </TableCell>

                      <TableCell className={cn(TD_CLS, "max-w-40 whitespace-normal")} title={row.subjects}>
                        {row.subjects || <Dash />}
                      </TableCell>

                      <TableCell className={cn(TD_CLS, "max-w-44 whitespace-normal")} title={row.subjectsExtra}>
                        {row.subjectsExtra ? (
                          <span className="text-muted-foreground">{row.subjectsExtra}</span>
                        ) : <Dash />}
                        {row.moneyExtra.length > 0 && (
                          <div className="mt-0.5 font-medium tabular-nums">
                            <MoneyLines rows={row.moneyExtra} field="price" symbolMap={symbolMap} />
                          </div>
                        )}
                      </TableCell>

                      <TableCell className={cn(NUM_CLS, GROUP_EDGE)}>
                        <MoneyLines rows={row.money} field="price" symbolMap={symbolMap} />
                      </TableCell>
                      <TableCell className={NUM_CLS}>
                        <MoneyLines rows={row.scheduleTotal} field="schedule" symbolMap={symbolMap} />
                      </TableCell>
                      <TableCell className={NUM_CLS}>
                        <MoneyLines rows={row.planDue} field="plan" symbolMap={symbolMap} />
                      </TableCell>
                      <TableCell className={cn(NUM_CLS, paidRed && "font-semibold text-destructive")}>
                        <MoneyLines rows={row.money} field="payed" symbolMap={symbolMap} />
                      </TableCell>
                      <TableCell className={cn(NUM_CLS, extraUWarn && "font-semibold text-destructive")}>
                        {extraBill !== null ? (
                          <>{fmtMoneyDec(extraBill)} <span className="text-muted-foreground">€</span></>
                        ) : <Dash />}
                      </TableCell>

                      {TRAINING_GROUPS.map((g) => {
                        const { plan, done } = mergeMinutes(row.trainings, g.names);
                        return (
                          <React.Fragment key={g.id}>
                            <TableCell className={cn(NUM_CLS, GROUP_EDGE)}>
                              {plan > 0 ? fmtMinutes(plan) : <Dash />}
                            </TableCell>
                            <TableCell className={cn(NUM_CLS, plan > 0 && done >= plan && "font-semibold text-emerald-700 dark:text-emerald-400")}>
                              {done > 0 ? fmtMinutes(done) : <Dash />}
                            </TableCell>
                            {g.extra && (
                              <TableCell className={cn(NUM_CLS, row.pplExtraMinutes > 0 && "font-semibold")}>
                                {row.pplExtraMinutes > 0 ? fmtMinutes(row.pplExtraMinutes) : <Dash />}
                              </TableCell>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {RATING_BITS.map((b, i) => {
                        const bit = row.ratingBits[b.id];
                        return (
                          <TableCell
                            key={b.id}
                            className={cn(TD_CLS, "text-center tabular-nums", i === 0 && GROUP_EDGE)}
                            data-field={b.id === "atpl" ? "atpl_th" : b.id}
                            data-student={row.mId}
                            data-auto-plan={bit.auto_plan}
                            data-plan-manual={bit.plan_manual ?? ""}
                            data-flown={bit.flown}
                            data-school={bit.school}
                            title={`${b.label}: Plan=${bit.plan} Uçmuş=${bit.flown}${bit.school ? ` (${bit.school})` : ""}`}
                          >
                            <span className="font-semibold">{bit.plan}/{bit.flown}</span>
                            {bit.school && (
                              <span className="block text-[10px] text-muted-foreground">{bit.school === "sau_utek" ? "SAÜ" : "BY"}</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    {!currentFilters.student && (
                      <ListNoteRow
                        studentId={row.mId}
                        studentName={`${row.firstName} ${row.lastName}`}
                        visible={noteModeOn}
                        initialBody={row.lastNote}
                        initialAuthor={row.lastNoteAuthor}
                        initialAt={row.lastNoteAt}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className={TD_CLS}></TableCell>
                <TableHead scope="row" className="px-2 py-1.5 align-top text-xs font-semibold">TOPLAM</TableHead>
                <TableCell className={TD_CLS}></TableCell>
                <TableCell className={cn(TD_CLS, "tabular-nums")}>
                  <MoneyLines rows={totals.moneyExtra} field="price" symbolMap={symbolMap} />
                </TableCell>
                <TableCell className={cn(NUM_CLS, GROUP_EDGE)}>
                  <MoneyLines rows={totals.moneyPrice} field="price" symbolMap={symbolMap} />
                </TableCell>
                <TableCell className={NUM_CLS}>
                  <MoneyLines rows={totals.schedule} field="schedule" symbolMap={symbolMap} />
                </TableCell>
                <TableCell className={NUM_CLS}>
                  <MoneyLines rows={totals.planDue} field="plan" symbolMap={symbolMap} />
                </TableCell>
                <TableCell className={NUM_CLS}>
                  <MoneyLines rows={totals.moneyPayed} field="payed" symbolMap={symbolMap} />
                </TableCell>
                <TableCell className={NUM_CLS}>
                  {totals.extraBill > 0 ? (
                    <>{fmtMoneyDec(totals.extraBill)} <span className="text-muted-foreground">€</span></>
                  ) : <Dash />}
                </TableCell>
                {totals.training.map((g) => (
                  <React.Fragment key={g.id}>
                    <TableCell className={cn(NUM_CLS, GROUP_EDGE)}>
                      {g.plan > 0 ? fmtMinutes(g.plan) : <Dash />}
                    </TableCell>
                    <TableCell className={NUM_CLS}>
                      {g.done > 0 ? fmtMinutes(g.done) : <Dash />}
                    </TableCell>
                    {g.extra && (
                      <TableCell className={NUM_CLS}>
                        {totals.pplExtraMinutes > 0 ? fmtMinutes(totals.pplExtraMinutes) : <Dash />}
                      </TableCell>
                    )}
                  </React.Fragment>
                ))}
                {RATING_BITS.map((b, i) => (
                  <TableCell key={b.id} className={cn(TD_CLS, i === 0 && GROUP_EDGE)}></TableCell>
                ))}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {detay && rows[0] && (
        <OgrenciDetay row={rows[0]} detay={detay} symbolMap={symbolMap} />
      )}
    </div>
  );
}
