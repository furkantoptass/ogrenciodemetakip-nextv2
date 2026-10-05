import { Fragment } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarClock, CalendarDays, CalendarX, ChevronLeft, ChevronRight } from "lucide-react";
import { requirePageModule } from "@/lib/odt-yetki";
import { fmtGun, fmtPara, fmtSayi, fmtToplam, gunEkle, gunFarki, istanbulBugun } from "@/lib/format";
import {
  ayEkle,
  ayHaftalari,
  ayParam,
  getOdemeTakvim,
  taksitDurum,
  type TakvimTaksit,
  type TaksitDurum,
} from "@/lib/odeme-takvim";
import { cn } from "@/lib/utils";
import { KpiCard, NUM_CLS, TD_CLS, TH_CLS } from "@/components/kpi-card";
import { PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ödeme takvimi" };

const GUNLER: Array<[kisa: string, uzun: string]> = [
  ["Pzt", "Pazartesi"],
  ["Sal", "Salı"],
  ["Çar", "Çarşamba"],
  ["Per", "Perşembe"],
  ["Cum", "Cuma"],
  ["Cmt", "Cumartesi"],
  ["Paz", "Pazar"],
];
/** Takvim hücresinde gösterilen en fazla ödeme; kalanı gün listesine bağlanır. */
const HUCRE_LIMIT = 3;
const YAKIN_GUN = 30;

const AY_FMT = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" });
const GUN_FMT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" });

const DURUM: Record<
  TaksitDurum,
  { label: string; chip: string; dot: string; badge: "default" | "secondary" | "destructive" | "outline" }
> = {
  today: { label: "Bugün", chip: "bg-primary text-primary-foreground hover:bg-primary/85", dot: "bg-primary", badge: "default" },
  pending: { label: "Bekliyor", chip: "bg-primary/10 text-primary hover:bg-primary/20", dot: "bg-primary/40", badge: "outline" },
  overdue: {
    label: "Gecikti",
    chip: "bg-destructive/10 text-destructive hover:bg-destructive/20",
    dot: "bg-destructive",
    badge: "destructive",
  },
  paid: { label: "Ödendi", chip: "bg-chart-3/15 text-foreground hover:bg-chart-3/25", dot: "bg-chart-3", badge: "secondary" },
};
const LEJANT: TaksitDurum[] = ["today", "pending", "overdue", "paid"];

function tek(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[v.length - 1] : v;
}

function ayAdi(ym: string): string {
  return AY_FMT.format(new Date(`${ym}-01T00:00:00Z`));
}

function gunAdi(ymd: string): string {
  return GUN_FMT.format(new Date(`${ymd}T00:00:00Z`));
}

function kalan(bugun: string, ymd: string): string {
  const n = gunFarki(bugun, ymd);
  if (n === 0) return "bugün";
  return n === 1 ? "yarın" : `${fmtSayi(n)} gün sonra`;
}

function tutar(t: TakvimTaksit): string {
  return fmtPara(t.amount, t.symbol ?? t.shortcode);
}

function ozet(rows: TakvimTaksit[], bos: string): string {
  if (rows.length === 0) return bos;
  return `${fmtSayi(new Set(rows.map((t) => t.studentId)).size)} öğrenci · ${fmtToplam(rows)}`;
}

export default async function OdemeTakvimiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageModule("liste");
  const sp = await searchParams;
  const bugun = istanbulBugun();
  const ay = ayParam(tek(sp.ay), bugun.slice(0, 7));
  const gunler = ayHaftalari(ay).flat();
  const yakinSon = gunEkle(bugun, YAKIN_GUN);

  // Izgara, ayın ilk ve son haftasını tamamlayan komşu ay günlerini de kapsar.
  const [izgara, yakin] = await Promise.all([
    getOdemeTakvim(gunler[0], gunler[gunler.length - 1]),
    getOdemeTakvim(bugun, yakinSon),
  ]);
  const gunluk = new Map<string, TakvimTaksit[]>();
  for (const t of izgara) gunluk.set(t.date, [...(gunluk.get(t.date) ?? []), t]);

  const ayTaksit = izgara.filter((t) => t.date.startsWith(ay));
  const ayGunleri = [...new Set(ayTaksit.map((t) => t.date))];
  const odenen = ayTaksit.filter((t) => t.paid);
  const geciken = ayTaksit.filter((t) => taksitDurum(t, bugun) === "overdue");
  const bekleyen = ayTaksit.filter((t) => !t.paid && t.date >= bugun);
  const yaklasan = yakin.filter((t) => !t.paid);

  return (
    <PageShell>
      <PageHeader
        title="Ödeme takvimi"
        description={`${ayAdi(ay)} · taksit vadelerine göre kim, hangi gün, ne kadar ödeyecek`}
      >
        <Button variant="outline" size="icon-sm" aria-label="Önceki ay" render={<Link href={`/odeme-takvimi?ay=${ayEkle(ay, -1)}`} />}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button variant="outline" size="sm" render={<Link href="/odeme-takvimi" />}>
          Bu ay
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Sonraki ay" render={<Link href={`/odeme-takvimi?ay=${ayEkle(ay, 1)}`} />}>
          <ChevronRight aria-hidden="true" />
        </Button>
        <form method="get" action="/odeme-takvimi" className="flex items-center gap-2">
          <Input type="month" name="ay" defaultValue={ay} aria-label="Aya git" className="h-7 w-40" />
          <Button type="submit" variant="outline" size="sm">
            Git
          </Button>
        </form>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Ay içindeki taksit"
          value={fmtSayi(ayTaksit.length)}
          hint={ozet(ayTaksit, "Bu ayda vadesi olan taksit yok")}
          icon={CalendarDays}
        />
        <KpiCard
          title="Bekleyen"
          value={fmtSayi(bekleyen.length)}
          hint={ozet(bekleyen, "Ödeme bekleyen taksit yok")}
          icon={CalendarClock}
        />
        <KpiCard
          title="Geciken"
          value={fmtSayi(geciken.length)}
          hint={ozet(geciken, "Vadesi geçip ödenmeyen taksit yok")}
          icon={CalendarX}
          tone={geciken.length > 0 ? "danger" : "default"}
        />
        <KpiCard title="Ödendi" value={fmtSayi(odenen.length)} hint={ozet(odenen, "Ödendi işaretli taksit yok")} icon={CalendarCheck} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>{ayAdi(ay)}</CardTitle>
            <CardDescription className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {LEJANT.map((d) => (
                <span key={d} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", DURUM[d].dot)} aria-hidden="true" />
                  {DURUM[d].label}
                </span>
              ))}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="grid min-w-[46rem] grid-cols-7 overflow-hidden rounded-lg border-t border-l text-xs">
              {GUNLER.map(([kisa, uzun]) => (
                <div
                  key={kisa}
                  className="border-r border-b bg-muted px-2 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                >
                  <span className="lg:hidden" aria-hidden="true">
                    {kisa}
                  </span>
                  <span className="sr-only lg:not-sr-only">{uzun}</span>
                </div>
              ))}
              {gunler.map((g) => {
                const list = gunluk.get(g) ?? [];
                const ayDisi = !g.startsWith(ay);
                const bugunMu = g === bugun;
                return (
                  <div
                    key={g}
                    className={cn(
                      "flex min-h-28 min-w-0 flex-col gap-1 border-r border-b p-1.5",
                      ayDisi && "bg-muted/40",
                      bugunMu && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        aria-current={bugunMu ? "date" : undefined}
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full tabular-nums",
                          bugunMu
                            ? "bg-primary font-semibold text-primary-foreground"
                            : ayDisi
                              ? "text-muted-foreground/60"
                              : "text-muted-foreground"
                        )}
                      >
                        {Number(g.slice(8))}
                      </span>
                      {list.length > 0 ? (
                        <span className="truncate text-[11px] font-medium tabular-nums">{fmtToplam(list)}</span>
                      ) : null}
                    </div>
                    {list.slice(0, HUCRE_LIMIT).map((t) => {
                      const d = DURUM[taksitDurum(t, bugun)];
                      return (
                        <Link
                          key={t.id}
                          href={`/ogrenciler?student=${t.studentId}`}
                          title={`${t.name} · ${tutar(t)} · ${d.label}`}
                          className={cn("block rounded-md px-1.5 py-1 leading-tight transition-colors", d.chip)}
                        >
                          <span className="block truncate font-medium">{t.name || `#${t.studentId}`}</span>
                          <span className="block truncate tabular-nums opacity-80">{tutar(t)}</span>
                          <span className="sr-only">{d.label}</span>
                        </Link>
                      );
                    })}
                    {list.length > HUCRE_LIMIT ? (
                      <Link
                        href={ayDisi ? `/odeme-takvimi?ay=${g.slice(0, 7)}#gun-${g}` : `#gun-${g}`}
                        className="px-1.5 text-[11px] text-muted-foreground hover:underline"
                      >
                        +{fmtSayi(list.length - HUCRE_LIMIT)} ödeme daha
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Önümüzdeki {YAKIN_GUN} gün</CardTitle>
            <CardDescription>
              {fmtGun(bugun)} – {fmtGun(yakinSon)} arasında ödeme bekleyenler
            </CardDescription>
            <CardAction>
              <Badge variant="secondary">{fmtSayi(yaklasan.length)}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {yaklasan.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Önümüzdeki {YAKIN_GUN} günde vadesi gelen taksit yok.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {yaklasan.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={`/ogrenciler?student=${t.studentId}`} className="block truncate font-medium hover:underline">
                        {t.name || `#${t.studentId}`}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {gunAdi(t.date)} · {kalan(bugun, t.date)}
                      </span>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">{tutar(t)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="sm" className="mt-4 w-full" render={<Link href="/geciken-odemeler" />}>
              Geciken ödemeleri gör
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gün gün ödemeler</CardTitle>
          <CardDescription>{ayAdi(ay)} içinde vadesi olan taksitler</CardDescription>
          <CardAction>
            <Badge variant="secondary">{fmtSayi(ayTaksit.length)}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {ayTaksit.length === 0 ? (
            <div className="py-8 text-center">
              <p className="font-medium">Bu ayda vadesi olan taksit yok</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Takvim, Naeron’da sözleşmeye girilen taksit planlarından oluşur. Başka bir aya geç ya da Naeron’da taksit
                planı ekle.
              </p>
            </div>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className={TH_CLS}>Öğrenci</TableHead>
                  <TableHead className={TH_CLS}>Telefon</TableHead>
                  <TableHead className={TH_CLS}>Sözleşme</TableHead>
                  <TableHead className={TH_CLS}>Taksit</TableHead>
                  <TableHead className={TH_CLS}>Durum</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Tutar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ayGunleri.map((g) => {
                  const list = gunluk.get(g) ?? [];
                  return (
                    <Fragment key={g}>
                      <TableRow id={`gun-${g}`} className="scroll-mt-20 bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={5} className="px-3 py-1.5 font-medium">
                          {gunAdi(g)}
                          {g === bugun ? <Badge className="ml-2">Bugün</Badge> : null}
                        </TableCell>
                        <TableCell className={`${NUM_CLS} py-1.5 font-medium`}>{fmtToplam(list)}</TableCell>
                      </TableRow>
                      {list.map((t) => {
                        const durum = taksitDurum(t, bugun);
                        return (
                          <TableRow key={t.id}>
                            <TableCell className={TD_CLS}>
                              <Link href={`/ogrenciler?student=${t.studentId}`} className="font-medium hover:underline">
                                {t.name || `#${t.studentId}`}
                              </Link>
                            </TableCell>
                            <TableCell className={`${TD_CLS} tabular-nums text-muted-foreground`}>{t.gsm || "—"}</TableCell>
                            <TableCell className={TD_CLS}>{t.subject || "—"}</TableCell>
                            <TableCell className={TD_CLS}>
                              {t.installment || "—"}
                              {t.note ? <span className="mt-0.5 block max-w-64 text-muted-foreground">{t.note}</span> : null}
                            </TableCell>
                            <TableCell className={TD_CLS}>
                              <Badge variant={DURUM[durum].badge}>
                                {durum === "overdue"
                                  ? `${fmtSayi(gunFarki(t.date, bugun))} gün gecikti`
                                  : DURUM[durum].label}
                              </Badge>
                            </TableCell>
                            <TableCell className={cn(NUM_CLS, "font-medium", durum === "overdue" && "text-destructive")}>
                              {tutar(t)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
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
