import Link from "next/link";
import { Ban, Clock, PlaneTakeoff, Rows3, X } from "lucide-react";
import { requirePageModule } from "@/lib/odt-yetki";
import { fmtGun, fmtSaat, fmtSayi, fmtYuzde, gunEkle, istanbulBugun, tarihParam } from "@/lib/format";
import { getUcusFiltreler, getUcusSayfa, UCUS_LIMIT, type UcusDurum } from "@/lib/ucus";
import { KpiCard, NUM_CLS, SELECT_CLS, TABLE_WRAP_CLS, TD_CLS, TH_STICKY_CLS } from "@/components/kpi-card";
import { PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Uçuşlar" };

function tek(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[v.length - 1] : v;
}

function pozitif(v: string | undefined): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export default async function UcuslarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageModule("liste");
  const sp = await searchParams;
  const bugun = istanbulBugun();
  const to = tarihParam(tek(sp.to), bugun);
  const from = tarihParam(tek(sp.from), gunEkle(to, -30));
  const q = (tek(sp.q) ?? "").trim().slice(0, 80);
  const student = pozitif(tek(sp.student));
  const instructor = pozitif(tek(sp.instructor));
  const aircraft = pozitif(tek(sp.aircraft));
  const statusRaw = tek(sp.status);
  const status: UcusDurum = statusRaw === "realized" || statusRaw === "canceled" ? statusRaw : null;

  const [filtreler, sayfa] = await Promise.all([
    getUcusFiltreler(),
    getUcusSayfa({ from, to, q: q || null, student, instructor, aircraft, status }),
  ]);
  const { ozet, rows, matched } = sayfa;
  const filtreli = Boolean(q || student || instructor || aircraft || status);

  return (
    <PageShell>
      <PageHeader
        title="Uçuşlar"
        description={`${fmtGun(from)} – ${fmtGun(to)} arasında ${fmtSayi(ozet.total)} uçuş kaydı`}
      >
        <Button variant="outline" size="sm" render={<Link href={`/iptaller?from=${from}&to=${to}`} />}>
          <Ban aria-hidden="true" />
          İptal analizi
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Planlanan uçuş" value={fmtSayi(ozet.total)} hint="Gerçekleşen ve iptal edilenler" icon={Rows3} />
        <KpiCard
          title="Gerçekleşen"
          value={fmtSayi(ozet.realized)}
          hint={`${fmtSayi(ozet.students)} farklı öğrenci`}
          icon={PlaneTakeoff}
        />
        <KpiCard title="Uçuş saati" value={`${fmtSaat(ozet.minutes)} sa`} hint="Gerçekleşen uçuşların blok süresi" icon={Clock} />
        <KpiCard
          title="İptal edilen"
          value={fmtSayi(ozet.canceled)}
          hint={`İptal oranı ${fmtYuzde(ozet.canceled, ozet.total)}`}
          icon={Ban}
          tone={ozet.canceled > 0 ? "danger" : "default"}
        />
      </div>

      <Card size="sm">
        <CardContent>
          <form method="get" action="/ucuslar" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {student ? <input type="hidden" name="student" value={student} /> : null}
            <div className="flex flex-col gap-1">
              <Label htmlFor="ucus-from">Başlangıç</Label>
              <Input id="ucus-from" type="date" name="from" defaultValue={from} className="h-8" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ucus-to">Bitiş</Label>
              <Input id="ucus-to" type="date" name="to" defaultValue={to} className="h-8" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ucus-q">Ara</Label>
              <Input id="ucus-q" type="search" name="q" defaultValue={q} placeholder="Öğrenci, öğretmen, görev" className="h-8" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ucus-instructor">Öğretmen</Label>
              <select id="ucus-instructor" name="instructor" defaultValue={instructor ? String(instructor) : ""} className={SELECT_CLS}>
                <option value="">Tümü</option>
                {filtreler.instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ucus-aircraft">Uçak</Label>
              <select id="ucus-aircraft" name="aircraft" defaultValue={aircraft ? String(aircraft) : ""} className={SELECT_CLS}>
                <option value="">Tümü</option>
                {filtreler.aircraft.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ucus-status">Durum</Label>
              <select id="ucus-status" name="status" defaultValue={status ?? ""} className={SELECT_CLS}>
                <option value="">Tümü</option>
                <option value="realized">Gerçekleşen</option>
                <option value="canceled">İptal edilen</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm">
                Uygula
              </Button>
              {filtreli ? (
                <Button variant="ghost" size="sm" render={<Link href={`/ucuslar?from=${from}&to=${to}`} />}>
                  <X aria-hidden="true" />
                  Temizle
                </Button>
              ) : null}
            </div>
          </form>
          {student ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Yalnızca seçili öğrencinin uçuşları gösteriliyor.{" "}
              <Link href={`/ogrenciler?student=${student}`} className="text-primary underline-offset-4 hover:underline">
                Öğrenci kartını aç
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">Bu filtrelerle uçuş bulunamadı</p>
            <p className="mt-1 text-sm text-muted-foreground">Tarih aralığını genişlet ya da filtreleri temizle.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className={TABLE_WRAP_CLS}>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className={TH_STICKY_CLS}>Tarih</TableHead>
                  <TableHead className={TH_STICKY_CLS}>Saat</TableHead>
                  <TableHead className={TH_STICKY_CLS}>Öğrenci</TableHead>
                  <TableHead className={TH_STICKY_CLS}>Öğretmen</TableHead>
                  <TableHead className={TH_STICKY_CLS}>Uçak</TableHead>
                  <TableHead className={TH_STICKY_CLS}>Görev</TableHead>
                  <TableHead className={TH_STICKY_CLS}>Rota</TableHead>
                  <TableHead className={`${TH_STICKY_CLS} text-right`}>Süre</TableHead>
                  <TableHead className={TH_STICKY_CLS}>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className={`${TD_CLS} tabular-nums whitespace-nowrap`}>{fmtGun(r.date)}</TableCell>
                    <TableCell className={`${TD_CLS} tabular-nums text-muted-foreground`}>{r.time}</TableCell>
                    <TableCell className={`${TD_CLS} font-medium`}>
                      {r.studentId ? (
                        <Link href={`/ogrenciler?student=${r.studentId}`} className="hover:underline">
                          {r.student || `#${r.studentId}`}
                        </Link>
                      ) : (
                        r.student || "—"
                      )}
                    </TableCell>
                    <TableCell className={TD_CLS}>{r.instructor || "—"}</TableCell>
                    <TableCell className={`${TD_CLS} whitespace-nowrap`}>
                      {r.aircraft || "—"}
                      {r.type === "simulator" ? (
                        <Badge variant="outline" className="ml-1.5">
                          Simülatör
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className={TD_CLS}>{r.duty || "—"}</TableCell>
                    <TableCell className={`${TD_CLS} text-muted-foreground`}>{r.route || "—"}</TableCell>
                    <TableCell className={NUM_CLS}>{r.canceled ? "—" : fmtSaat(r.minutes)}</TableCell>
                    <TableCell className={TD_CLS}>
                      {r.canceled ? (
                        <>
                          <Badge variant="destructive">İptal</Badge>
                          <span className="mt-1 block max-w-64 text-muted-foreground">
                            {r.cancelNote || "Neden belirtilmemiş"}
                          </span>
                        </>
                      ) : (
                        <Badge variant="secondary">Gerçekleşti</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {matched > rows.length ? (
            <p className="text-xs text-muted-foreground">
              {fmtSayi(matched)} kayıttan en yeni {fmtSayi(UCUS_LIMIT)} tanesi gösteriliyor. Daha eskileri görmek için
              tarih aralığını daralt.
            </p>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
