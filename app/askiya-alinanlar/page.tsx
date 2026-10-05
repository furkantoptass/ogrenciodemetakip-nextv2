import Link from "next/link";
import { Ban, CalendarX, CirclePause, Hourglass, Wallet } from "lucide-react";
import { requirePageModule } from "@/lib/odt-yetki";
import { fmtGun, fmtSaat, fmtSayi, fmtToplam, fmtYuzde, gunFarki, istanbulBugun } from "@/lib/format";
import { getAskidaSayfa, type AskidaOgrenci } from "@/lib/askida";
import { labelTextColor } from "@/lib/hesaplamalar";
import { KpiCard, NUM_CLS, TD_CLS, TH_CLS } from "@/components/kpi-card";
import { PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Askıya alınanlar" };

/** Uçuş listesinde öğrencinin bütün geçmişini açmak için yeterince eski bir başlangıç. */
const UCUS_BASLANGIC = "2015-01-01";

function EgitimDurumu({ status }: { status: string }) {
  if (status === "graduated") return <Badge variant="outline">Mezun</Badge>;
  if (status === "paused") return <Badge variant="outline">Dondurulmuş</Badge>;
  return <Badge variant="secondary">Aktif</Badge>;
}

function Etiket({ name, color }: { name: string; color: string | null }) {
  if (!name) return null;
  const hex = color && /^#[0-9a-f]{6}$/i.test(color) ? color : null;
  return (
    <span
      className="mt-1 inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] font-medium"
      style={hex ? { backgroundColor: hex, color: labelTextColor(hex) } : undefined}
    >
      {name}
    </span>
  );
}

function ucussuzGun(r: AskidaOgrenci, bugun: string): number | null {
  return r.lastFlight ? Math.max(0, gunFarki(r.lastFlight, bugun)) : null;
}

export default async function AskiyaAlinanlarPage() {
  await requirePageModule("liste");
  const bugun = istanbulBugun();
  const { total, rows } = await getAskidaSayfa(bugun);

  const gecikenler = rows.filter((r) => r.overdue.length > 0);
  const borclular = rows.filter((r) => r.open.length > 0);
  const enUzun = Math.max(0, ...rows.map((r) => ucussuzGun(r, bugun) ?? 0));

  return (
    <PageShell>
      <PageHeader
        title="Askıya alınanlar"
        description="Naeron’da uçuşları askıya alınan öğrenciler. İptal edilen uçuşlardan farklıdır: tek bir uçuş değil, öğrencinin uçuşları durdurulmuştur."
      >
        <Button variant="outline" size="sm" render={<Link href="/iptaller" />}>
          <Ban aria-hidden="true" />
          İptal edilen uçuşlar
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Uçuşu askıda"
          value={fmtSayi(rows.length)}
          hint={`${fmtSayi(total)} öğrencinin ${fmtYuzde(rows.length, total)} kadarı`}
          icon={CirclePause}
          tone={rows.length > 0 ? "danger" : "default"}
        />
        <KpiCard
          title="Vadesi geçmiş taksiti olan"
          value={fmtSayi(gecikenler.length)}
          hint={
            gecikenler.length > 0
              ? `Geciken ${fmtToplam(gecikenler.flatMap((r) => r.overdue))}`
              : "Askıdaki öğrencilerde geciken taksit yok"
          }
          icon={CalendarX}
          tone={gecikenler.length > 0 ? "danger" : "default"}
        />
        <KpiCard
          title="Açık bakiyesi olan"
          value={fmtSayi(borclular.length)}
          hint={
            borclular.length > 0
              ? `Tahsil edilmemiş ${fmtToplam(borclular.flatMap((r) => r.open))}`
              : "Askıdaki öğrencilerde açık bakiye yok"
          }
          icon={Wallet}
        />
        <KpiCard
          title="En uzun uçuşsuz süre"
          value={enUzun > 0 ? `${fmtSayi(enUzun)} gün` : "—"}
          hint="Son uçuştan bugüne geçen süre"
          icon={Hourglass}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Uçuşu askıya alınan öğrenciler</CardTitle>
          <CardDescription>
            Naeron öğrenci kartındaki “uçuşları askıya al” işaretinden gelir. Naeron askıya alma nedenini ve tarihini
            paylaşmaz; “Kayıt güncellendi” sütunu öğrenci kaydının Naeron’da en son değiştiği günü gösterir.
          </CardDescription>
          <CardAction>
            <Badge variant={rows.length > 0 ? "destructive" : "secondary"}>{fmtSayi(rows.length)}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="py-8 text-center">
              <p className="font-medium">Uçuşu askıya alınmış öğrenci yok</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Naeron’da bir öğrencinin uçuşları askıya alındığında, eşitlemeden sonra burada görünür.
              </p>
            </div>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className={TH_CLS}>Öğrenci</TableHead>
                  <TableHead className={TH_CLS}>Eğitim</TableHead>
                  <TableHead className={TH_CLS}>Durum</TableHead>
                  <TableHead className={TH_CLS}>Son uçuş</TableHead>
                  <TableHead className={TH_CLS}>Uçuşsuz</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Toplam uçuş</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Açık bakiye</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Geciken taksit</TableHead>
                  <TableHead className={TH_CLS}>Son not</TableHead>
                  <TableHead className={TH_CLS}>Kayıt güncellendi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const gun = ucussuzGun(r, bugun);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className={TD_CLS}>
                        <Link href={`/ogrenciler?student=${r.id}`} className="font-medium hover:underline">
                          {r.name || `#${r.id}`}
                        </Link>
                        <span className="block tabular-nums text-muted-foreground">
                          {[r.studentNo ? `No ${r.studentNo}` : "", r.gsm].filter(Boolean).join(" · ") || "—"}
                        </span>
                        <Etiket name={r.label} color={r.labelColor} />
                      </TableCell>
                      <TableCell className={TD_CLS}>
                        {r.training || "—"}
                        {r.phase ? <span className="block text-muted-foreground">{r.phase}</span> : null}
                      </TableCell>
                      <TableCell className={TD_CLS}>
                        <EgitimDurumu status={r.trainingStatus} />
                      </TableCell>
                      <TableCell className={`${TD_CLS} whitespace-nowrap`}>
                        <span className="tabular-nums">{fmtGun(r.lastFlight)}</span>
                        {r.lastDuty ? <span className="block text-muted-foreground">{r.lastDuty}</span> : null}
                      </TableCell>
                      <TableCell className={TD_CLS}>
                        {gun === null ? (
                          <span className="text-muted-foreground">Hiç uçmadı</span>
                        ) : (
                          <Badge variant="outline">{fmtSayi(gun)} gün</Badge>
                        )}
                      </TableCell>
                      <TableCell className={NUM_CLS}>
                        <Link href={`/ucuslar?student=${r.id}&from=${UCUS_BASLANGIC}`} className="hover:underline">
                          {fmtSayi(r.flights)} uçuş · {fmtSaat(r.minutes)} sa
                        </Link>
                        {r.canceled > 0 ? (
                          <span className="block text-muted-foreground">{fmtSayi(r.canceled)} iptal</span>
                        ) : null}
                      </TableCell>
                      <TableCell className={NUM_CLS}>{fmtToplam(r.open)}</TableCell>
                      <TableCell className={NUM_CLS}>
                        {r.overdue.length > 0 ? (
                          <>
                            <span className="font-medium text-destructive">{fmtToplam(r.overdue)}</span>
                            <span className="block text-muted-foreground">{fmtGun(r.overdueSince)} tarihinden beri</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className={`${TD_CLS} max-w-xs whitespace-normal`}>
                        {r.note ? (
                          <>
                            <span className="line-clamp-3">{r.note}</span>
                            <span className="mt-0.5 block text-muted-foreground">
                              {[r.noteAuthor, fmtGun(r.noteDate)].filter(Boolean).join(" · ")}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Not yok</span>
                        )}
                      </TableCell>
                      <TableCell className={`${TD_CLS} tabular-nums whitespace-nowrap`}>{fmtGun(r.updated)}</TableCell>
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
