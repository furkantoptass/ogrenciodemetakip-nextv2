import type { ReactNode } from "react";
import { SearchX, TriangleAlert } from "lucide-react";
import type { OgrenciRow } from "@/lib/ogrenci";
import { extraBilledEur, fmtMoneyDec, fmtMoneyEu } from "@/lib/hesaplamalar";
import { PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const MONEY_EQ_TOL = 1;

const TH_CLS =
  "h-auto bg-muted px-3 py-2 align-bottom text-[11px] leading-tight font-medium tracking-wide whitespace-normal text-muted-foreground uppercase shadow-[inset_0_-1px_0_var(--color-border)]";
const TD_CLS = "px-3 py-2 align-top";
const NUM_CLS = "px-3 py-2 text-right align-top tabular-nums";

type MoneyExtra = { currencyID: number; sum_price?: number };

function extraSAmount(row: OgrenciRow): number {
  let n = 0;
  for (const r of row.moneyExtra) n += r.sum_price ?? 0;
  return n;
}

function extraURed(row: OgrenciRow, extraBill: number | null): boolean {
  return Math.abs(extraSAmount(row) - (extraBill ?? 0)) > MONEY_EQ_TOL;
}

function hasExtra(row: OgrenciRow): boolean {
  if ((row.subjectsExtra ?? "").trim()) return true;
  if (row.moneyExtra.some((r) => Math.abs(r.sum_price ?? 0) >= 1e-6)) return true;
  return extraBilledEur(row.pplExtraMinutes) != null;
}

function moneyParts(rows: MoneyExtra[], symbolMap: Record<number, string>): string[] {
  const parts: string[] = [];
  for (const r of rows) {
    const n = r.sum_price ?? 0;
    const sym = symbolMap[r.currencyID] ?? "¤";
    if (Math.abs(n) >= 1e-6 || sym !== "¤") parts.push(`${fmtMoneyEu(n)} ${sym}`);
  }
  return parts;
}

function sumExtraByCurrency(rows: OgrenciRow[]): MoneyExtra[] {
  const by: Record<number, number> = {};
  for (const row of rows) {
    for (const r of row.moneyExtra) {
      if (!r.currencyID) continue;
      by[r.currencyID] = (by[r.currencyID] ?? 0) + (r.sum_price ?? 0);
    }
  }
  return Object.entries(by)
    .map(([currencyID, n]) => ({ currencyID: Number(currencyID), sum_price: n }))
    .filter((r) => Math.abs(r.sum_price) >= 1e-6);
}

function Dash() {
  return <span className="text-muted-foreground/50">—</span>;
}

function MoneyLines({ parts }: { parts: string[] }) {
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

export default function EkstraTable({
  rows,
  symbolMap,
}: {
  rows: OgrenciRow[];
  symbolMap: Record<number, string>;
}) {
  const shown = rows.filter(hasExtra);
  const totalExtraS = moneyParts(sumExtraByCurrency(shown), symbolMap);
  const totalExtraU = shown.reduce((acc, r) => acc + (extraBilledEur(r.pplExtraMinutes) ?? 0), 0);
  const mismatchCount = shown.filter((r) => extraURed(r, extraBilledEur(r.pplExtraMinutes))).length;

  return (
    <PageShell>
      <PageHeader
        title="Ekstra"
        description={
          <>
            Extra sözleşmesi (EXTRA-S) veya ücretli extra uçuşu (EXTRA-U) olan öğrenciler · gösterilen öğrenci:{" "}
            <strong className="font-semibold text-foreground tabular-nums">{shown.length}</strong>
          </>
        }
      />

      <section aria-label="Özet göstergeler" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Öğrenci" hint="EXTRA-S veya EXTRA-U kaydı olan">
          {shown.length}
        </KpiCard>
        <KpiCard label="Toplam EXTRA-S" hint="Extra sözleşme bedelleri">
          <MoneyLines parts={totalExtraS} />
        </KpiCard>
        <KpiCard label="Toplam EXTRA-U" hint="Ücretli extra uçuş süresi × 500 €/saat">
          {totalExtraU > 0 ? (
            <>
              {fmtMoneyDec(totalExtraU)} <span className="text-muted-foreground">€</span>
            </>
          ) : (
            <Dash />
          )}
        </KpiCard>
        <KpiCard
          label="Tutarı uyuşmayan"
          hint="EXTRA-S ile EXTRA-U farklı"
          tone={mismatchCount > 0 ? "destructive" : "default"}
        >
          {mismatchCount}
        </KpiCard>
      </section>

      {shown.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <SearchX className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Extra kaydı yok</p>
            <p className="text-sm text-muted-foreground">
              Extra sözleşmesi veya ücretli extra uçuşu olan öğrenci bulunduğunda burada listelenir.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          className="max-h-[calc(100dvh-9rem)] min-w-0 overflow-auto rounded-xl bg-card ring-1 ring-foreground/10 [contain:inline-size] print:max-h-none print:overflow-visible [&_[data-slot=table-container]]:overflow-visible"
          role="region"
          aria-label="Extra listesi"
          tabIndex={0}
        >
          <Table className="min-w-[640px]">
            <TableHeader className="sticky top-0 z-10 [&_tr]:border-b-0">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className={cn(TH_CLS, "w-10 text-right")}>#</TableHead>
                <TableHead scope="col" className={TH_CLS} title="Öğrenci">Ad Soyad</TableHead>
                <TableHead scope="col" className={TH_CLS} title="Extra sözleşmeler">EXTRA-S</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "text-right")} title="Extra sözleşmelerin toplam bedeli">
                  EXTRA-S tutarı
                </TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "text-right")} title="Ücretli extra uçuş süresi × 500 €/saat">
                  EXTRA-U
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((row, idx) => {
                const extraBill = extraBilledEur(row.pplExtraMinutes);
                const extraUWarn = extraURed(row, extraBill);
                return (
                  <TableRow key={row.mId}>
                    <TableCell className={cn(NUM_CLS, "text-muted-foreground")}>{idx + 1}</TableCell>
                    <TableCell className={cn(TD_CLS, "whitespace-normal")}>
                      <a
                        href={`/ogrenciler?student=${row.mId}`}
                        className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {row.firstName} <span className="font-semibold uppercase">{row.lastName}</span>
                      </a>
                      {row.shortCode ? <div className="mt-0.5 text-xs text-muted-foreground">{row.shortCode}</div> : null}
                    </TableCell>
                    <TableCell className={cn(TD_CLS, "max-w-md whitespace-normal")} title={row.subjectsExtra}>
                      {row.subjectsExtra ? <span className="text-muted-foreground">{row.subjectsExtra}</span> : <Dash />}
                    </TableCell>
                    <TableCell className={cn(NUM_CLS, "font-medium")}>
                      <MoneyLines parts={moneyParts(row.moneyExtra, symbolMap)} />
                    </TableCell>
                    <TableCell className={cn(NUM_CLS, extraUWarn && "font-semibold text-destructive")}>
                      {extraBill !== null ? (
                        <>
                          {fmtMoneyDec(extraBill)} <span className={extraUWarn ? undefined : "text-muted-foreground"}>€</span>
                        </>
                      ) : (
                        <Dash />
                      )}
                      {extraUWarn ? (
                        <div className="mt-1 flex justify-end">
                          <Badge variant="destructive" title="EXTRA-S tutarı ile EXTRA-U tutarı birbirini tutmuyor">
                            <TriangleAlert aria-hidden />
                            Tutar uyuşmuyor
                          </Badge>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className={TD_CLS}></TableCell>
                <TableHead scope="row" className="h-auto px-3 py-2 align-top text-xs font-semibold">
                  TOPLAM
                </TableHead>
                <TableCell className={TD_CLS}></TableCell>
                <TableCell className={NUM_CLS}>
                  <MoneyLines parts={totalExtraS} />
                </TableCell>
                <TableCell className={NUM_CLS}>
                  {totalExtraU > 0 ? (
                    <>
                      {fmtMoneyDec(totalExtraU)} <span className="text-muted-foreground">€</span>
                    </>
                  ) : (
                    <Dash />
                  )}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </PageShell>
  );
}
