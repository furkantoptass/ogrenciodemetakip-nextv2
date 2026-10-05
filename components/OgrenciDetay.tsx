"use client";

import { CircleAlert, ExternalLink, FileText } from "lucide-react";
import type { OgrenciRow } from "@/lib/ogrenci";
import type { OgrenciDetayData } from "@/lib/ogrenci-detay";
import { fmtMinutes, fmtMoneyDec, fmtMoneyEu, fmtIsoDay, labelTextColor } from "@/lib/hesaplamalar";
import OgrenciNotlar from "@/components/OgrenciNotlar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const RATING_LABEL: Record<string, string> = { cpl: "CPL", ir: "IR", me: "ME", atpl: "ATPL theory" };
const SCHOOL: Record<string, string> = { sau_utek: "SAÜ", by: "BY" };

const TH_CLS = "h-8 px-3 text-xs font-medium text-muted-foreground";
const TD_CLS = "px-3 py-1.5";
const NUM_CLS = "px-3 py-1.5 text-right tabular-nums";

function moneyLine(
  rows: Array<{ currencyID: number; sum_price?: number; sum_payed?: number; sum_schedule?: number; sum_plan?: number }>,
  field: "price" | "payed" | "schedule" | "plan",
  symbolMap: Record<number, string>
): string {
  const parts: string[] = [];
  for (const r of rows) {
    const n = field === "price" ? (r.sum_price ?? 0) : field === "payed" ? (r.sum_payed ?? 0) : field === "schedule" ? (r.sum_schedule ?? 0) : (r.sum_plan ?? 0);
    const sym = symbolMap[r.currencyID] ?? "¤";
    if (Math.abs(n) >= 1e-6 || sym !== "¤") parts.push(`${fmtMoneyEu(n)} ${sym}`);
  }
  return parts.length ? parts.join(" · ") : "—";
}

function instStatus(s: string): string {
  const l = s.trim().toLowerCase();
  if (l === "payed" || l === "paid") return "Ödendi";
  if (l === "notpayed" || l === "unpaid") return "Ödenmedi";
  return s || "—";
}

function instPaid(s: string): boolean {
  const l = s.trim().toLowerCase();
  return l === "payed" || l === "paid";
}

function groupByContract<T extends { contractId: number; subject: string }>(rows: T[]): Array<{ contractId: number; subject: string; rows: T[] }> {
  const map = new Map<number, { contractId: number; subject: string; rows: T[] }>();
  for (const r of rows) {
    const id = r.contractId || 0;
    const cur = map.get(id);
    if (cur) cur.rows.push(r);
    else map.set(id, { contractId: id, subject: r.subject || "Sözleşme", rows: [r] });
  }
  return [...map.values()];
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "destructive" }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border bg-background px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm font-semibold tabular-nums", tone === "destructive" && "text-destructive")}>{value}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className="overflow-hidden rounded-lg border">{children}</div>
    </section>
  );
}

function TabCount({ n }: { n: number }) {
  return <span className="text-xs text-muted-foreground tabular-nums">{n}</span>;
}

export default function OgrenciDetay({
  row,
  detay,
  symbolMap,
}: {
  row: OgrenciRow;
  detay: OgrenciDetayData;
  symbolMap: Record<number, string>;
}) {
  const extraBill = detay.extraBill;
  const instGroups = groupByContract(detay.installments);
  const payGroups = groupByContract(detay.payments);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-lg">
          {row.firstName} <span className="font-semibold uppercase">{row.lastName}</span>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-1.5">
          {row.shortCode && <span className="font-medium text-foreground">{row.shortCode}</span>}
          {row.corpLabelColor ? (
            <Badge style={{ background: row.corpLabelColor, color: labelTextColor(row.corpLabelColor) }}>{row.corpLabelName}</Badge>
          ) : (
            <Badge variant="secondary" className="text-muted-foreground">Etiketsiz</Badge>
          )}
          {row.fleetName && <Badge variant="outline">{row.fleetName}</Badge>}
          {row.facilityName && <Badge variant="outline">{row.facilityName}</Badge>}
          {row.paidBehind && (
            <Badge variant="destructive">
              <CircleAlert aria-hidden />
              Vadesi geçmiş ödeme var
            </Badge>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          <Stat label="Toplam sözleşme" value={moneyLine(row.money, "price", symbolMap)} />
          <Stat label="Toplam ödeme planı" value={moneyLine(row.scheduleTotal, "schedule", symbolMap)} />
          <Stat label="Vadesi gelmiş" value={moneyLine(row.planDue, "plan", symbolMap)} />
          <Stat label="Ödenen" value={moneyLine(row.money, "payed", symbolMap)} tone={row.paidBehind ? "destructive" : undefined} />
          <Stat
            label="Extra uçuş"
            value={`${extraBill != null ? `${fmtMoneyDec(extraBill)} €` : "—"}${detay.extraMinutes > 0 ? ` (${fmtMinutes(detay.extraMinutes)})` : ""}`}
          />
        </dl>

        <Tabs defaultValue="plan" className="min-w-0 gap-3">
          <div className="overflow-x-auto border-b pb-1">
            <TabsList variant="line" aria-label="Öğrenci detayı">
              <TabsTrigger value="plan">Ödeme planı <TabCount n={detay.installments.length} /></TabsTrigger>
              <TabsTrigger value="odemeler">Ödemeler <TabCount n={detay.payments.length} /></TabsTrigger>
              <TabsTrigger value="ucuslar">Uçuşlar <TabCount n={detay.flights.length} /></TabsTrigger>
              <TabsTrigger value="notlar">Notlar</TabsTrigger>
              <TabsTrigger value="sozlesmeler">Sözleşmeler <TabCount n={detay.pdfs.length} /></TabsTrigger>
              <TabsTrigger value="yetkiler">CPL / IR / ME / ATPL</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="plan" className="flex flex-col gap-4">
            {instGroups.length === 0 && <Empty>Taksit yok</Empty>}
            {instGroups.map((g) => (
              <Panel key={g.contractId} title={g.subject}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead scope="col" className={TH_CLS}>Vade</TableHead>
                      <TableHead scope="col" className={TH_CLS}>Ad</TableHead>
                      <TableHead scope="col" className={cn(TH_CLS, "text-right")}>Tutar</TableHead>
                      <TableHead scope="col" className={TH_CLS}>Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.rows.map((r, i) => (
                      <TableRow key={`${g.contractId}-${i}`}>
                        <TableCell className={cn(TD_CLS, "tabular-nums")}>{fmtIsoDay(r.date)}</TableCell>
                        <TableCell className={cn(TD_CLS, "whitespace-normal")}>{r.name || "—"}</TableCell>
                        <TableCell className={NUM_CLS}>{fmtMoneyDec(r.price)} {symbolMap[r.currencyId] ?? ""}</TableCell>
                        <TableCell className={TD_CLS}>
                          <Badge variant={instPaid(r.status) ? "secondary" : "outline"}>{instStatus(r.status)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            ))}
          </TabsContent>

          <TabsContent value="odemeler" className="flex flex-col gap-4">
            {payGroups.length === 0 && <Empty>Ödeme yok</Empty>}
            {payGroups.map((g) => (
              <Panel key={g.contractId} title={g.subject}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead scope="col" className={TH_CLS}>Tarih</TableHead>
                      <TableHead scope="col" className={cn(TH_CLS, "text-right")}>Tutar</TableHead>
                      <TableHead scope="col" className={TH_CLS}>Not</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.rows.map((r, i) => (
                      <TableRow key={`${g.contractId}-${i}`}>
                        <TableCell className={cn(TD_CLS, "tabular-nums")}>{fmtIsoDay(r.date)}</TableCell>
                        <TableCell className={NUM_CLS}>{fmtMoneyDec(r.amount)} {symbolMap[r.currencyId] ?? ""}</TableCell>
                        <TableCell className={cn(TD_CLS, "whitespace-normal text-muted-foreground")}>
                          {[r.note, r.creator].filter(Boolean).join(" — ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            ))}
          </TabsContent>

          <TabsContent value="ucuslar">
            {detay.flights.length === 0 ? (
              <Empty>Uçuş yok</Empty>
            ) : (
              <Panel title="Uçuş defteri">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead scope="col" className={TH_CLS}>Tarih</TableHead>
                      <TableHead scope="col" className={TH_CLS}>Görev</TableHead>
                      <TableHead scope="col" className={TH_CLS}>Uçak</TableHead>
                      <TableHead scope="col" className={TH_CLS}>Rota</TableHead>
                      <TableHead scope="col" className={cn(TH_CLS, "text-right")}>Süre</TableHead>
                      <TableHead scope="col" className={TH_CLS}>Eğitmen</TableHead>
                      <TableHead scope="col" className={TH_CLS}><span className="sr-only">Tür</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detay.flights.map((f, i) => (
                      <TableRow key={i} className={f.control ? "bg-muted/40" : undefined}>
                        <TableCell className={cn(TD_CLS, "tabular-nums")}>{fmtIsoDay(f.date)}</TableCell>
                        <TableCell className={TD_CLS}>{f.duty || "—"}</TableCell>
                        <TableCell className={TD_CLS}>{f.aircraft || "—"}</TableCell>
                        <TableCell className={TD_CLS}>{f.route || "—"}</TableCell>
                        <TableCell className={NUM_CLS}>{fmtMinutes(f.minutes)}</TableCell>
                        <TableCell className={TD_CLS}>{f.instructor || "—"}</TableCell>
                        <TableCell className={TD_CLS}>
                          {f.control && <Badge>KONTROL</Badge>}
                          {f.extra && !f.control && <Badge variant="outline">EXTRA</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            )}
          </TabsContent>

          <TabsContent value="notlar" keepMounted>
            <OgrenciNotlar studentId={row.mId} initial={detay.notes} />
          </TabsContent>

          <TabsContent value="sozlesmeler">
            {detay.pdfs.length === 0 ? (
              <Empty>PDF yok</Empty>
            ) : (
              <ul className="divide-y rounded-lg border">
                {detay.pdfs.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-sm font-medium">{p.subject || "Sözleşme"}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{fmtIsoDay(p.signDate)}</span>
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto inline-flex min-w-0 items-center gap-1 rounded-sm text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="truncate">{p.fileName}</span>
                        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                        <span className="sr-only">(yeni sekmede açılır)</span>
                      </a>
                    ) : (
                      <span className="ml-auto min-w-0 truncate text-sm text-muted-foreground">{p.fileName}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="yetkiler">
            <Panel title="CPL / IR / ME / ATPL">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead scope="col" className={TH_CLS}><span className="sr-only">Yetki</span></TableHead>
                    <TableHead scope="col" className={cn(TH_CLS, "text-right")}>Plan</TableHead>
                    <TableHead scope="col" className={cn(TH_CLS, "text-right")}>Uçmuş</TableHead>
                    <TableHead scope="col" className={TH_CLS}>Okul</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(["cpl", "ir", "me", "atpl"] as const).map((id) => {
                    const b = row.ratingBits[id];
                    return (
                      <TableRow key={id}>
                        <TableHead scope="row" className="h-auto px-3 py-1.5 font-medium">{RATING_LABEL[id]}</TableHead>
                        <TableCell className={NUM_CLS}>{b.plan}</TableCell>
                        <TableCell className={NUM_CLS}>{b.flown}</TableCell>
                        <TableCell className={TD_CLS}>{SCHOOL[b.school] || b.school || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Panel>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
