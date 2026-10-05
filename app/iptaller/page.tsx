import Link from "next/link";
import { Ban, FileQuestion, FileText, Rows3, X } from "lucide-react";
import { requirePageModule } from "@/lib/odt-yetki";
import { fmtGun, fmtSayi, fmtYuzde, gunEkle, istanbulBugun, tarihParam } from "@/lib/format";
import { getIptalSayfa, UCUS_LIMIT, type IptalKirilim } from "@/lib/ucus";
import { IptalGrafik } from "@/components/iptal/iptal-grafik";
import { CHECK_CLS, KpiCard, TABLE_WRAP_CLS, TD_CLS, TH_STICKY_CLS } from "@/components/kpi-card";
import { PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata = { title: "İptaller" };

function tek(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[v.length - 1] : v;
}

function Kirilim({
  title,
  description,
  rows,
  linkStudents,
}: {
  title: string;
  description: string;
  rows: IptalKirilim[];
  linkStudents?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Bu dönemde iptal yok.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rows.map((r, i) => {
              const oran = r.total > 0 ? (r.canceled / r.total) * 100 : 0;
              return (
                <li key={`${r.name}-${i}`} className="text-sm">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    {linkStudents && r.studentId ? (
                      <Link href={`/ucuslar?student=${r.studentId}&status=canceled`} className="truncate hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      <span className="truncate">{r.name}</span>
                    )}
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {fmtSayi(r.canceled)} / {fmtSayi(r.total)} · {fmtYuzde(r.canceled, r.total)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-destructive/70" style={{ width: `${oran}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function IptallerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageModule("liste");
  const sp = await searchParams;
  const bugun = istanbulBugun();
  const to = tarihParam(tek(sp.to), bugun);
  const from = tarihParam(tek(sp.from), gunEkle(to, -365));
  const q = (tek(sp.q) ?? "").trim().slice(0, 80);
  const onlyNote = tek(sp.only_note) === "1";

  const o = await getIptalSayfa({ from, to, q: q || null, onlyNote });
  const nedensiz = o.ozet.canceled - o.ozet.withNote;

  return (
    <PageShell>
      <PageHeader
        title="İptaller"
        description={`${fmtGun(from)} – ${fmtGun(to)} arasında iptal edilen uçuşlar ve nedenleri`}
      >
        <Button variant="outline" size="sm" render={<Link href={`/ucuslar?from=${from}&to=${to}`} />}>
          Tüm uçuşlar
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Planlanan uçuş" value={fmtSayi(o.ozet.total)} hint="Gerçekleşen ve iptal edilenler" icon={Rows3} />
        <KpiCard
          title="İptal edilen"
          value={fmtSayi(o.ozet.canceled)}
          hint={`İptal oranı ${fmtYuzde(o.ozet.canceled, o.ozet.total)}`}
          icon={Ban}
          tone={o.ozet.canceled > 0 ? "danger" : "default"}
        />
        <KpiCard
          title="Nedeni yazılan"
          value={fmtSayi(o.ozet.withNote)}
          hint={`İptallerin ${fmtYuzde(o.ozet.withNote, o.ozet.canceled)} kadarı`}
          icon={FileText}
        />
        <KpiCard
          title="Nedeni yazılmayan"
          value={fmtSayi(nedensiz)}
          hint="Naeron'da iptal notu boş bırakılmış"
          icon={FileQuestion}
          tone={nedensiz > 0 ? "danger" : "default"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aylara göre uçuşlar</CardTitle>
          <CardDescription>Her ay gerçekleşen ve iptal edilen uçuş sayısı</CardDescription>
        </CardHeader>
        <CardContent>
          <IptalGrafik data={o.monthly} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Kirilim title="Öğretmene göre" description="En çok iptali olan 15 öğretmen · iptal / toplam" rows={o.byInstructor} />
        <Kirilim title="Uçağa göre" description="En çok iptali olan 15 uçak · iptal / toplam" rows={o.byAircraft} />
        <Kirilim
          title="Öğrenciye göre"
          description="En çok iptali olan 15 öğrenci · iptal / toplam"
          rows={o.byStudent}
          linkStudents
        />
      </div>

      <Card size="sm">
        <CardContent>
          <form method="get" action="/iptaller" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col gap-1">
              <Label htmlFor="iptal-from">Başlangıç</Label>
              <Input id="iptal-from" type="date" name="from" defaultValue={from} className="h-8" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="iptal-to">Bitiş</Label>
              <Input id="iptal-to" type="date" name="to" defaultValue={to} className="h-8" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="iptal-q">Ara</Label>
              <Input
                id="iptal-q"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Öğrenci, öğretmen, neden"
                className="h-8"
              />
            </div>
            <label className="flex items-end gap-2 pb-1.5 text-sm">
              <input type="checkbox" name="only_note" value="1" defaultChecked={onlyNote} className={CHECK_CLS} />
              Yalnızca nedeni yazılanlar
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm">
                Uygula
              </Button>
              {q || onlyNote ? (
                <Button variant="ghost" size="sm" render={<Link href={`/iptaller?from=${from}&to=${to}`} />}>
                  <X aria-hidden="true" />
                  Temizle
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {o.rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">Bu filtrelerle iptal edilen uçuş bulunamadı</p>
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
                  <TableHead className={TH_STICKY_CLS}>Öğrenci</TableHead>
                  <TableHead className={TH_STICKY_CLS}>Öğretmen</TableHead>
                  <TableHead className={TH_STICKY_CLS}>Uçak</TableHead>
                  <TableHead className={TH_STICKY_CLS}>Görev</TableHead>
                  <TableHead className={TH_STICKY_CLS}>İptal nedeni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className={`${TD_CLS} tabular-nums whitespace-nowrap`}>{fmtGun(r.date)}</TableCell>
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
                    <TableCell className={`${TD_CLS} whitespace-nowrap`}>{r.aircraft || "—"}</TableCell>
                    <TableCell className={TD_CLS}>{r.duty || "—"}</TableCell>
                    <TableCell className={`${TD_CLS} max-w-md whitespace-normal`}>
                      {r.cancelNote ? r.cancelNote : <Badge variant="outline">Belirtilmemiş</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {o.matched > o.rows.length ? (
            <p className="text-xs text-muted-foreground">
              {fmtSayi(o.matched)} iptalden en yeni {fmtSayi(UCUS_LIMIT)} tanesi gösteriliyor. Daha eskileri görmek için
              tarih aralığını daralt.
            </p>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
