import Link from "next/link";
import { Clock, Plane, PlaneTakeoff, ShieldAlert, ShieldCheck } from "lucide-react";
import { requirePageModule } from "@/lib/odt-yetki";
import { fmtGun, fmtSaat, fmtSayi, gunEkle, gunFarki, istanbulBugun } from "@/lib/format";
import { filoDurum, getFiloSayfa, type FiloArac, type FiloDurum } from "@/lib/filo";
import { KpiCard, NUM_CLS, TD_CLS, TH_CLS } from "@/components/kpi-card";
import { PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Filo" };

/** UEGGS süresi bu kadar gün içinde dolacaksa uyarı gösterilir. */
const UEGGS_UYARI_GUN = 60;

const TACHO = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const DURUM: Record<FiloDurum, { label: string; variant: "secondary" | "destructive" | "outline"; sira: number }> = {
  hazir: { label: "Uçuşa hazır", variant: "secondary", sira: 0 },
  bakim: { label: "Bakımda", variant: "destructive", sira: 1 },
  "sure-doldu": { label: "UEGGS süresi doldu", variant: "destructive", sira: 2 },
  belgesiz: { label: "UEGGS girilmemiş", variant: "outline", sira: 3 },
  "envanter-disi": { label: "Envanter dışı", variant: "outline", sira: 4 },
};

const MOTOR: Record<string, string> = { singleEngine: "Tek motor", multiEngine: "Çift motor" };

function Tescil({ a }: { a: FiloArac }) {
  const hex = a.color && /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : null;
  return (
    <span className="inline-flex items-center gap-2 font-medium whitespace-nowrap">
      <span
        className="size-2.5 shrink-0 rounded-full bg-muted ring-1 ring-foreground/15"
        style={hex ? { backgroundColor: hex } : undefined}
        aria-hidden="true"
      />
      {a.reg || `#${a.id}`}
    </span>
  );
}

function Ueggs({ arc, bugun }: { arc: string | null; bugun: string }) {
  if (!arc) return <span className="text-muted-foreground">—</span>;
  const kalan = gunFarki(bugun, arc);
  return (
    <>
      <span className="tabular-nums">{fmtGun(arc)}</span>
      <span className={`block ${kalan <= UEGGS_UYARI_GUN ? "font-medium text-destructive" : "text-muted-foreground"}`}>
        {kalan < 0 ? `${fmtSayi(-kalan)} gün önce doldu` : kalan === 0 ? "Bugün doluyor" : `${fmtSayi(kalan)} gün kaldı`}
      </span>
    </>
  );
}

function SonUcus({ a }: { a: FiloArac }) {
  if (!a.lastFlight) return <span className="text-muted-foreground">Kayıt yok</span>;
  return (
    <>
      <span className="tabular-nums">{fmtGun(a.lastFlight)}</span>
      {a.lastBase ? <span className="block text-muted-foreground">{a.lastBase}</span> : null}
    </>
  );
}

function Kullanim({ flights, minutes, canceled }: { flights: number; minutes: number; canceled?: number }) {
  if (flights === 0 && !canceled) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      {fmtSayi(flights)} uçuş · {fmtSaat(minutes)} sa
      {canceled ? <span className="block text-muted-foreground">{fmtSayi(canceled)} iptal</span> : null}
    </>
  );
}

/** "C172" ve "C-172" gibi farklı yazımları tek tipte toplar. */
function tipOzeti(list: FiloArac[]): string {
  const by = new Map<string, number>();
  for (const a of list) {
    const key = a.model.replace(/[\s-]/g, "").toUpperCase();
    if (key) by.set(key, (by.get(key) ?? 0) + 1);
  }
  return [...by.entries()]
    .sort((x, y) => y[1] - x[1])
    .map(([tip, n]) => `${tip} ×${n}`)
    .join(" · ");
}

export default async function FiloPage() {
  await requirePageModule("liste");
  const bugun = istanbulBugun();
  const from30 = gunEkle(bugun, -29);
  const hepsi = await getFiloSayfa(bugun);

  // Okulun kendi uçakları: Naeron'da harici olarak işaretlenmemiş hava araçları.
  const ucaklar = hepsi
    .filter((a) => a.kind === "aircraft" && !a.external)
    .sort(
      (x, y) =>
        DURUM[filoDurum(x, bugun)].sira - DURUM[filoDurum(y, bugun)].sira ||
        (y.lastFlight ?? "").localeCompare(x.lastFlight ?? "") ||
        x.reg.localeCompare(y.reg, "tr")
    );
  const diger = hepsi.filter((a) => a.kind !== "aircraft" || a.external);

  const hazir = ucaklar.filter((a) => filoDurum(a, bugun) === "hazir");
  const bakimda = ucaklar.filter((a) => filoDurum(a, bugun) === "bakim");
  const suresiDolan = ucaklar.filter((a) => filoDurum(a, bugun) === "sure-doldu");
  const dolacak = hazir.filter((a) => a.arc !== null && gunFarki(bugun, a.arc) <= UEGGS_UYARI_GUN);
  const ucus30 = ucaklar.reduce((n, a) => n + a.flights30, 0);
  const dakika30 = ucaklar.reduce((n, a) => n + a.minutes30, 0);
  const ucan30 = ucaklar.filter((a) => a.flights30 > 0).length;

  return (
    <PageShell>
      <PageHeader
        title="Filo"
        description="Okulun hava araçları: tescil, tip, bakım ve uçuşa elverişlilik durumu ile kullanım özeti"
      >
        <Button variant="outline" size="sm" render={<Link href="/ucuslar" />}>
          <PlaneTakeoff aria-hidden="true" />
          Uçuşlar
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Uçak"
          value={fmtSayi(ucaklar.length)}
          hint={tipOzeti(ucaklar) || "Naeron’da tip bilgisi girilmemiş"}
          icon={Plane}
        />
        <KpiCard
          title="Uçuşa hazır"
          value={fmtSayi(hazir.length)}
          hint={
            bakimda.length > 0
              ? `${fmtSayi(bakimda.length)} uçak bakımda`
              : "Bakımda değil, UEGGS süresi geçerli"
          }
          icon={ShieldCheck}
        />
        <KpiCard
          title="UEGGS süresi dolan"
          value={fmtSayi(suresiDolan.length)}
          hint={
            dolacak.length > 0
              ? `${fmtSayi(dolacak.length)} uçağın süresi ${UEGGS_UYARI_GUN} gün içinde dolacak`
              : `${UEGGS_UYARI_GUN} gün içinde süresi dolacak uçak yok`
          }
          icon={ShieldAlert}
          tone={suresiDolan.length > 0 ? "danger" : "default"}
        />
        <KpiCard
          title="Son 30 gün uçuş saati"
          value={`${fmtSaat(dakika30)} sa`}
          hint={`${fmtSayi(ucus30)} uçuş · ${fmtSayi(ucan30)} uçak uçtu`}
          icon={Clock}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Uçaklar</CardTitle>
          <CardDescription>
            Naeron’daki hava aracı kayıtları. UEGGS, uçuşa elverişlilik gözden geçirme sertifikasının geçerlilik
            tarihidir; kullanım sayıları uçuş kayıtlarından hesaplanır.
          </CardDescription>
          <CardAction>
            <Badge variant="secondary">{fmtSayi(ucaklar.length)}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {ucaklar.length === 0 ? (
            <div className="py-8 text-center">
              <p className="font-medium">Henüz uçak kaydı yok</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Uçak listesi Naeron’dan çekilir. Naeron Eşitleme ekranından eşitlemeyi çalıştır.
              </p>
            </div>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className={TH_CLS}>Tescil</TableHead>
                  <TableHead className={TH_CLS}>Tip</TableHead>
                  <TableHead className={TH_CLS}>Durum</TableHead>
                  <TableHead className={TH_CLS}>UEGGS geçerlilik</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Tacho</TableHead>
                  <TableHead className={TH_CLS}>Son uçuş</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Son 30 gün</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Toplam</TableHead>
                  <TableHead className={TH_CLS}>
                    <span className="sr-only">Uçuş listesi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ucaklar.map((a) => {
                  const d = DURUM[filoDurum(a, bugun)];
                  return (
                    <TableRow key={a.id}>
                      <TableCell className={TD_CLS}>
                        <Tescil a={a} />
                      </TableCell>
                      <TableCell className={TD_CLS}>
                        {a.model || "—"}
                        {MOTOR[a.engine] ? <span className="block text-muted-foreground">{MOTOR[a.engine]}</span> : null}
                      </TableCell>
                      <TableCell className={TD_CLS}>
                        <Badge variant={d.variant}>{d.label}</Badge>
                      </TableCell>
                      <TableCell className={`${TD_CLS} whitespace-nowrap`}>
                        <Ueggs arc={a.arc} bugun={bugun} />
                      </TableCell>
                      <TableCell className={NUM_CLS}>{a.tacho === null ? "—" : TACHO.format(a.tacho)}</TableCell>
                      <TableCell className={`${TD_CLS} whitespace-nowrap`}>
                        <SonUcus a={a} />
                      </TableCell>
                      <TableCell className={NUM_CLS}>
                        <Kullanim flights={a.flights30} minutes={a.minutes30} canceled={a.canceled30} />
                      </TableCell>
                      <TableCell className={NUM_CLS}>
                        <Kullanim flights={a.flights} minutes={a.minutes} />
                      </TableCell>
                      <TableCell className={TD_CLS}>
                        <Link
                          href={`/ucuslar?aircraft=${a.id}&from=${from30}&to=${bugun}`}
                          className="whitespace-nowrap text-primary underline-offset-4 hover:underline"
                        >
                          Uçuşları
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {diger.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Simülatörler ve harici araçlar</CardTitle>
            <CardDescription>Okulun uçak envanterine dahil olmayan, uçuş kayıtlarında kullanılan araçlar</CardDescription>
            <CardAction>
              <Badge variant="secondary">{fmtSayi(diger.length)}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className={TH_CLS}>Ad</TableHead>
                  <TableHead className={TH_CLS}>Tür</TableHead>
                  <TableHead className={TH_CLS}>Tip</TableHead>
                  <TableHead className={TH_CLS}>Son uçuş</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Son 30 gün</TableHead>
                  <TableHead className={`${TH_CLS} text-right`}>Toplam</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diger.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className={TD_CLS}>
                      <Tescil a={a} />
                    </TableCell>
                    <TableCell className={TD_CLS}>
                      <Badge variant="outline">{a.kind === "simulator" ? "Simülatör" : "Harici uçak"}</Badge>
                    </TableCell>
                    <TableCell className={TD_CLS}>{a.model || "—"}</TableCell>
                    <TableCell className={`${TD_CLS} whitespace-nowrap`}>
                      <SonUcus a={a} />
                    </TableCell>
                    <TableCell className={NUM_CLS}>
                      <Kullanim flights={a.flights30} minutes={a.minutes30} canceled={a.canceled30} />
                    </TableCell>
                    <TableCell className={NUM_CLS}>
                      <Kullanim flights={a.flights} minutes={a.minutes} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  );
}
