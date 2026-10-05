import Link from "next/link";
import { AlertTriangle, CalendarX, Hourglass, Wallet } from "lucide-react";
import { requirePageModule } from "@/lib/odt-yetki";
import { fmtGun, fmtPara, fmtSayi } from "@/lib/format";
import { getGecikenSayfa } from "@/lib/ucus";
import { KpiCard, NUM_CLS, TD_CLS, TH_CLS } from "@/components/kpi-card";
import { PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Geciken ödemeler" };

/** Para birimine göre toplamları "12.000 € + 5.000 ₺" biçiminde yazar. */
function toplamlar(rows: Array<{ amount: number; symbol: string | null; shortcode: string | null }>): string {
  const by = new Map<string, number>();
  for (const r of rows) {
    const key = r.symbol ?? r.shortcode ?? "";
    by.set(key, (by.get(key) ?? 0) + r.amount);
  }
  if (by.size === 0) return "—";
  return [...by.entries()].map(([sym, n]) => fmtPara(n, sym || null)).join(" + ");
}

function GunRozeti({ days }: { days: number | null }) {
  if (days === null) return <span className="text-muted-foreground">—</span>;
  return <Badge variant={days > 30 ? "destructive" : "outline"}>{fmtSayi(days)} gün</Badge>;
}

function Ogrenci({ id, name }: { id: number; name: string }) {
  return (
    <Link href={`/ogrenciler?student=${id}`} className="font-medium hover:underline">
      {name || `#${id}`}
    </Link>
  );
}

function Bos({ children }: { children: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export default async function GecikenOdemelerPage() {
  await requirePageModule("liste");
  const o = await getGecikenSayfa();
  const enEski = Math.max(0, ...o.installments.map((r) => r.days), ...o.behind.map((r) => r.days ?? 0));
  const gecikenOgrenci = new Set(o.installments.map((r) => r.studentId)).size;

  return (
    <PageShell>
      <PageHeader
        title="Geciken ödemeler"
        description="Vadesi geçmiş taksitler, ödeme planının gerisinde kalan öğrenciler ve açık sözleşme bakiyeleri"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Vadesi geçmiş taksit"
          value={fmtSayi(o.installments.length)}
          hint={
            o.installments.length > 0
              ? `${fmtSayi(gecikenOgrenci)} öğrenci · ${toplamlar(o.installments)}`
              : "Vadesi geçmiş ödenmemiş taksit yok"
          }
          icon={CalendarX}
          tone={o.installments.length > 0 ? "danger" : "default"}
        />
        <KpiCard
          title="Plana göre geride kalan"
          value={fmtSayi(o.behind.length)}
          hint={
            o.behind.length > 0
              ? `Eksik tahsilat ${toplamlar(o.behind.map((r) => ({ amount: r.behind, symbol: r.symbol, shortcode: r.shortcode })))}`
              : "Ödeme planının gerisinde öğrenci yok"
          }
          icon={AlertTriangle}
          tone={o.behind.length > 0 ? "danger" : "default"}
        />
        <KpiCard
          title="En eski gecikme"
          value={enEski > 0 ? `${fmtSayi(enEski)} gün` : "—"}
          hint="Vadesinden bugüne geçen süre"
          icon={Hourglass}
        />
        <KpiCard
          title="Açık sözleşme bakiyesi"
          value={toplamlar(o.open.map((r) => ({ amount: r.remaining, symbol: r.symbol, shortcode: r.shortcode })))}
          hint={`${fmtSayi(o.open.length)} öğrencide henüz tahsil edilmemiş tutar`}
          icon={Wallet}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vadesi geçmiş taksitler</CardTitle>
          <CardDescription>Tarihi geçmiş ve ödenmedi olarak işaretli taksitler, en eskiden yeniye</CardDescription>
          <CardAction>
            <Badge variant={o.installments.length > 0 ? "destructive" : "secondary"}>{fmtSayi(o.installments.length)}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {o.installments.length === 0 ? (
            <Bos>Vadesi geçmiş taksit yok.</Bos>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className={TH_CLS}>Öğrenci</TableHead>
                  <TableHead className={TH_CLS}>Telefon</TableHead>
                  <TableHead className={TH_CLS}>Sözleşme</TableHead>
                  <TableHead className={TH_CLS}>Taksit</TableHead>
                  <TableHead className={TH_CLS}>Vade</TableHead>
                  <TableHead className={TH_CLS}>Gecikme</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Tutar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.installments.map((r, i) => (
                  <TableRow key={`${r.studentId}-${r.date}-${i}`}>
                    <TableCell className={TD_CLS}>
                      <Ogrenci id={r.studentId} name={r.name} />
                    </TableCell>
                    <TableCell className={`${TD_CLS} tabular-nums text-muted-foreground`}>{r.gsm || "—"}</TableCell>
                    <TableCell className={TD_CLS}>{r.subject || "—"}</TableCell>
                    <TableCell className={TD_CLS}>{r.installment || "—"}</TableCell>
                    <TableCell className={`${TD_CLS} tabular-nums whitespace-nowrap`}>{fmtGun(r.date)}</TableCell>
                    <TableCell className={TD_CLS}>
                      <GunRozeti days={r.days} />
                    </TableCell>
                    <TableCell className={`${NUM_CLS} font-medium text-destructive`}>
                      {fmtPara(r.amount, r.symbol ?? r.shortcode)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ödeme planının gerisinde kalan öğrenciler</CardTitle>
          <CardDescription>
            Bugüne kadar vadesi gelen taksitlerin toplamı, sözleşmelerde tahsil edilen tutardan büyük olanlar
          </CardDescription>
          <CardAction>
            <Badge variant={o.behind.length > 0 ? "destructive" : "secondary"}>{fmtSayi(o.behind.length)}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {o.behind.length === 0 ? (
            <Bos>Ödeme planının gerisinde kalan öğrenci yok.</Bos>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className={TH_CLS}>Öğrenci</TableHead>
                  <TableHead className={TH_CLS}>Telefon</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Vadesi gelen</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Tahsil edilen</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Eksik</TableHead>
                  <TableHead className={TH_CLS}>İlk ödenmeyen vade</TableHead>
                  <TableHead className={TH_CLS}>Gecikme</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.behind.map((r, i) => {
                  const sym = r.symbol ?? r.shortcode;
                  return (
                    <TableRow key={`${r.studentId}-${i}`}>
                      <TableCell className={TD_CLS}>
                        <Ogrenci id={r.studentId} name={r.name} />
                      </TableCell>
                      <TableCell className={`${TD_CLS} tabular-nums text-muted-foreground`}>{r.gsm || "—"}</TableCell>
                      <TableCell className={NUM_CLS}>{fmtPara(r.due, sym)}</TableCell>
                      <TableCell className={NUM_CLS}>{fmtPara(r.paid, sym)}</TableCell>
                      <TableCell className={`${NUM_CLS} font-medium text-destructive`}>{fmtPara(r.behind, sym)}</TableCell>
                      <TableCell className={`${TD_CLS} tabular-nums whitespace-nowrap`}>{fmtGun(r.since)}</TableCell>
                      <TableCell className={TD_CLS}>
                        <GunRozeti days={r.days} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Açık sözleşme bakiyeleri</CardTitle>
          <CardDescription>
            Sözleşme tutarı tahsil edilenden büyük olan öğrenciler. Bu tutarların vadesi gelmemiş olabilir; gecikme
            sayılmaz.
          </CardDescription>
          <CardAction>
            <Badge variant="secondary">{fmtSayi(o.open.length)}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {o.open.length === 0 ? (
            <Bos>Açık bakiyesi olan öğrenci yok.</Bos>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className={TH_CLS}>Öğrenci</TableHead>
                  <TableHead className={TH_CLS}>Durum</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Sözleşme</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Tahsil edilen</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Kalan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.open.map((r, i) => {
                  const sym = r.symbol ?? r.shortcode;
                  return (
                    <TableRow key={`${r.studentId}-${i}`}>
                      <TableCell className={TD_CLS}>
                        <Ogrenci id={r.studentId} name={r.name} />
                      </TableCell>
                      <TableCell className={TD_CLS}>
                        {r.trainingStatus === "graduated" ? (
                          <Badge variant="outline">Mezun</Badge>
                        ) : r.trainingStatus === "paused" ? (
                          <Badge variant="outline">Dondurulmuş</Badge>
                        ) : (
                          <Badge variant="secondary">Aktif</Badge>
                        )}
                      </TableCell>
                      <TableCell className={NUM_CLS}>{fmtPara(r.price, sym)}</TableCell>
                      <TableCell className={NUM_CLS}>{fmtPara(r.payed, sym)}</TableCell>
                      <TableCell className={`${NUM_CLS} font-medium`}>{fmtPara(r.remaining, sym)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
