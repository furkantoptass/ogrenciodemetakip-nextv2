import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CalendarClock, GraduationCap, PlaneTakeoff, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { firstOpenHref, getYetki, hasModule } from "@/lib/odt-yetki";
import { getPanelOzet, type PanelTaksit } from "@/lib/panel";
import { UcusGrafik } from "@/components/panel/ucus-grafik";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Özet" };

const sayi = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

function para(n: number, symbol: string | null): string {
  return `${sayi.format(n)} ${symbol ?? ""}`.trim();
}

function saat(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${sayi.format(h)}:${String(m).padStart(2, "0")}`;
}

function gun(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return y && m && d ? `${d}.${m}.${y}` : ymd;
}

function zaman(iso: string | null): string {
  if (!iso) return "henüz yapılmadı";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "bilinmiyor";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(d);
}

function Kpi({
  title,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  hint: string;
  icon: typeof Wallet;
  tone?: "default" | "danger";
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardAction>
          <Icon className={tone === "danger" ? "size-4 text-destructive" : "size-4 text-muted-foreground"} aria-hidden="true" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold tabular-nums ${tone === "danger" ? "text-destructive" : ""}`}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function TaksitListesi({ rows, empty, danger }: { rows: PanelTaksit[]; empty: string; danger?: boolean }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {rows.map((r, i) => (
        <li key={`${r.studentId}-${r.date}-${i}`} className="flex items-center gap-3 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <Link href={`/ogrenciler?student=${r.studentId}`} className="block truncate font-medium hover:underline">
              {r.name || `#${r.studentId}`}
            </Link>
            <span className="text-xs text-muted-foreground">{gun(r.date)}</span>
          </div>
          <span className={`tabular-nums ${danger ? "font-medium text-destructive" : ""}`}>{para(r.amount, r.symbol)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function OzetPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const yetki = await getYetki(session.user.email);
  if (!yetki || !yetki.active) redirect("/yetki-yok");
  if (!hasModule(yetki, "liste")) redirect(firstOpenHref(yetki));

  const o = await getPanelOzet();
  const ana = o.money[0];
  const tahsilat = ana && ana.price > 0 ? Math.round((ana.payed / ana.price) * 100) : 0;
  const gecikenTaksit = o.overdue.reduce((n, r) => n + r.installments, 0);
  const gecikenOgrenci = o.overdue.reduce((n, r) => n + r.students, 0);
  const enCokEgitim = Math.max(1, ...o.trainings.map((t) => t.count));

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Özet</h1>
          <p className="text-sm text-muted-foreground">Naeron verisinin son eşitlemesi: {zaman(o.lastSync)}</p>
        </div>
        <Button variant="outline" size="sm" render={<Link href="/ogrenciler" />}>
          Öğrenci listesi
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title="Aktif öğrenci"
          value={sayi.format(o.students.active)}
          hint={`${sayi.format(o.students.graduated)} mezun · ${sayi.format(o.students.paused)} dondurulmuş · ${sayi.format(o.students.suspended)} uçuşu askıda`}
          icon={GraduationCap}
        />
        <Kpi
          title="Sözleşme toplamı"
          value={ana ? para(ana.price, ana.symbol) : "—"}
          hint={ana ? `${para(ana.payed, ana.symbol)} tahsil edildi (%${tahsilat}) · ${sayi.format(ana.contracts)} sözleşme` : "Sözleşme kaydı yok"}
          icon={Wallet}
        />
        <Kpi
          title="Vadesi geçmiş taksit"
          value={sayi.format(gecikenTaksit)}
          hint={
            gecikenTaksit > 0
              ? `${sayi.format(gecikenOgrenci)} öğrenci · ${o.overdue.map((r) => para(r.amount, r.symbol ?? r.shortcode)).join(" + ")}`
              : "Geciken ödeme yok"
          }
          icon={AlertTriangle}
          tone={gecikenTaksit > 0 ? "danger" : "default"}
        />
        <Kpi
          title="Son 30 gün uçuş"
          value={`${saat(o.flights30.minutes)} sa`}
          hint={`${sayi.format(o.flights30.count)} gerçekleşen uçuş`}
          icon={PlaneTakeoff}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Aylık uçuş saati</CardTitle>
            <CardDescription>Son 12 ay, gerçekleşen ve iptal edilmemiş uçuşlar</CardDescription>
          </CardHeader>
          <CardContent>
            <UcusGrafik data={o.flightsMonthly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eğitim dağılımı</CardTitle>
            <CardDescription>Mezun olmayan öğrencilerin güncel eğitimi</CardDescription>
          </CardHeader>
          <CardContent>
            {o.trainings.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Kayıt yok.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {o.trainings.map((t) => (
                  <li key={t.name} className="text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate">{t.name}</span>
                      <span className="tabular-nums text-muted-foreground">{sayi.format(t.count)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(t.count / enCokEgitim) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Geciken taksitler</CardTitle>
            <CardDescription>Vadesi geçmiş, ödenmemiş (en eskiden)</CardDescription>
            <CardAction>
              <Badge variant={gecikenTaksit > 0 ? "destructive" : "secondary"}>{sayi.format(gecikenTaksit)}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <TaksitListesi rows={o.overdueList} empty="Geciken taksit yok." danger />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yaklaşan taksitler</CardTitle>
            <CardDescription>Önümüzdeki 30 gün</CardDescription>
            <CardAction>
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <TaksitListesi rows={o.upcoming} empty="Önümüzdeki 30 günde vadesi gelen taksit yok." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Para birimine göre sözleşmeler</CardTitle>
            <CardDescription>İptal edilmemiş sözleşmeler</CardDescription>
          </CardHeader>
          <CardContent>
            {o.money.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sözleşme kaydı yok.</p>
            ) : (
              <ul className="divide-y">
                {o.money.map((m) => (
                  <li key={String(m.currencyId)} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="font-medium">{m.shortcode ?? "—"}</span>
                    <span className="text-right tabular-nums">
                      <span className="block">{para(m.price, m.symbol)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {para(m.payed, m.symbol)} tahsil · {para(Math.max(0, m.price - m.payed), m.symbol)} kalan
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Son uçuşlar</CardTitle>
          <CardDescription>En son gerçekleşen 8 uçuş</CardDescription>
        </CardHeader>
        <CardContent>
          {o.recentFlights.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Uçuş kaydı yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Öğrenci</TableHead>
                  <TableHead>Görev</TableHead>
                  <TableHead>Uçak</TableHead>
                  <TableHead>Öğretmen</TableHead>
                  <TableHead className="text-right">Süre</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.recentFlights.map((f, i) => (
                  <TableRow key={`${f.date}-${f.student}-${i}`}>
                    <TableCell className="tabular-nums">{gun(f.date)}</TableCell>
                    <TableCell className="font-medium">{f.student || "—"}</TableCell>
                    <TableCell>{f.duty || "—"}</TableCell>
                    <TableCell>{f.aircraft || "—"}</TableCell>
                    <TableCell>{f.instructor || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{saat(f.minutes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
