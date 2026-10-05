import Link from "next/link";
import { Check, ChevronDown, FilterX, Minus, Search, SearchX, Tags } from "lucide-react";
import HatDurumuPplPrint from "@/components/HatDurumuPplPrint";
import { PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { labelTextColor } from "@/lib/hesaplamalar";
import { hatDurumuFmtMin, type HatPplCard, type HatPplNazari, type HatPplPageData } from "@/lib/hat-durumu-ppl";
import { cn } from "@/lib/utils";

const COLSPAN = 13;

const SELECT_CLS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground";
const CHECK_CLS = "size-4 shrink-0 rounded border-input accent-primary";
const TH_CLS =
  "h-auto bg-muted px-2 py-1.5 align-bottom text-[11px] leading-tight font-medium tracking-wide whitespace-normal text-muted-foreground uppercase shadow-[inset_0_-1px_0_var(--color-border)] print:px-1 print:py-0.5 print:text-[7px]";
const TD_CLS = "px-2 py-1.5 align-top print:px-1 print:py-0.5";
const NUM_CLS = "px-2 py-1.5 text-right align-top tabular-nums print:px-1 print:py-0.5";
const SCREEN_ONLY = "print:hidden";

const KALAN_CLS: Record<string, string> = {
  "hd-h-kalan-green": "text-emerald-700 dark:text-emerald-400",
  "hd-h-kalan-yellow": "text-amber-700 dark:text-amber-400",
  "hd-h-kalan-red": "text-destructive",
};

function Dash() {
  return <span className="text-muted-foreground/50">—</span>;
}

function KeepQuery({
  filters,
  except,
}: {
  filters: HatPplPageData["filters"];
  except: string[];
}) {
  const skip = new Set(except);
  const fields: Array<{ name: string; value: string }> = [];
  const add = (name: string, value: string | number | boolean | undefined) => {
    if (skip.has(name) || value === undefined || value === "" || value === 0 || value === false) return;
    fields.push({ name, value: String(value) });
  };
  add("q", filters.q);
  add("fleet", filters.fleet);
  add("facility", filters.facility);
  add("group", filters.group);
  add("student", filters.student);
  if (filters.showGraduates) add("grad", "1");
  if (!filters.showSuspended) fields.push({ name: "susp", value: "0" });
  if (!filters.excludePplGrads) fields.push({ name: "exclude_ppl_grad", value: "0" });
  if (filters.showAllCorpLabels) add("corp_all_labels", "1");
  if (filters.corpFormSubmitted && !skip.has("corp")) {
    fields.push({ name: "corp_form", value: "1" });
    for (const id of filters.activeCorpIds) fields.push({ name: "corp", value: String(id) });
  }
  return (
    <>
      {fields.map((f, i) => (
        <input key={`${f.name}-${f.value}-${i}`} type="hidden" name={f.name} value={f.value} />
      ))}
    </>
  );
}

function CorpCheck({
  label,
  checked,
}: {
  label: { m_ID: number; name: string; color: string };
  checked: boolean;
}) {
  const color = (label.color ?? "").trim();
  const hasColor = color !== "" && color[0] === "#";
  return (
    <label className="flex min-w-0 cursor-pointer items-center gap-2 text-xs">
      <input type="checkbox" name="corp" value={label.m_ID} className={CHECK_CLS} defaultChecked={checked} />
      <span
        className={cn("truncate rounded-md px-2 py-0.5 font-medium", !hasColor && "bg-muted text-muted-foreground")}
        style={hasColor ? { background: color, color: labelTextColor(color) } : undefined}
      >
        {label.name}
      </span>
    </label>
  );
}

function NazariBadge({ nz }: { nz: HatPplNazari | null }) {
  if (nz !== null && nz.passed) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
        title="Nazari: geçti"
      >
        <Check aria-hidden />
        Geçti
      </Badge>
    );
  }
  if (nz !== null && nz.has_any) {
    return (
      <Badge variant="destructive" className="tabular-nums" title={`Nazari: ${nz.x}/${nz.n}`}>
        {nz.x}/{nz.n}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400" title="Nazari kaydı yok">
      <Minus aria-hidden />
      Yok
    </Badge>
  );
}

function StudentRow({ card, index, stageKey }: { card: HatPplCard; index: number; stageKey: string }) {
  const s = card.student;
  const hasFlight = s.last_duty !== "";
  return (
    <TableRow data-student-id={s.m_ID} data-stage={stageKey} className="print:break-inside-avoid">
      <TableCell className={cn(NUM_CLS, "text-muted-foreground")}>{index + 1}</TableCell>

      <TableCell className={cn(TD_CLS, "whitespace-normal")}>
        <Link
          href={card.href}
          prefetch={false}
          className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {s.firstName} <span className="font-semibold uppercase">{s.lastName}</span>
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-1 print:mt-0">
          {s.corpLabelID > 0 && s.corp_label_name !== "" ? (
            <Badge className="print:h-auto print:px-1 print:py-0 print:text-[7px]" style={{ background: card.cbg, color: card.ctx }}>
              {s.corp_label_name}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-muted-foreground print:h-auto print:px-1 print:py-0 print:text-[7px]">
              Etiketsiz
            </Badge>
          )}
          {card.fleetLbl !== "" && (
            <Badge variant="outline" title={s.fleet_name} className={cn("tabular-nums", SCREEN_ONLY)}>
              {card.fleetLbl}
            </Badge>
          )}
        </div>
        {s.shortCode !== "" && <div className={cn("mt-0.5 text-[11px] text-muted-foreground", SCREEN_ONLY)}>{s.shortCode}</div>}
      </TableCell>

      <TableCell className={cn(TD_CLS, "tabular-nums", SCREEN_ONLY)}>{s.stpl_no !== "" ? s.stpl_no : <Dash />}</TableCell>

      <TableCell className={cn(TD_CLS, SCREEN_ONLY)}>
        <NazariBadge nz={card.nazari} />
      </TableCell>

      <TableCell className={cn(TD_CLS, SCREEN_ONLY)}>
        {card.rev === "rev3" ? (
          <Badge variant="secondary">Rev3</Badge>
        ) : card.rev === "rev2" ? (
          <Badge variant="outline">Rev2</Badge>
        ) : (
          <Dash />
        )}
      </TableCell>

      {hasFlight ? (
        <>
          <TableCell className={cn(TD_CLS, "border-l tabular-nums")}>{card.lastDateFmt || <Dash />}</TableCell>
          <TableCell className={cn(TD_CLS, "whitespace-normal")}>
            <span className="font-medium">{s.last_duty}</span>
            {card.showCurrBadge && (
              <span className="ml-1 text-[11px] text-muted-foreground print:text-[7px]">({s.last_curriculum_duty})</span>
            )}
          </TableCell>
          <TableCell className={cn(TD_CLS, "max-w-40 whitespace-normal")}>
            {s.last_instr === "" ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-400">Solo</span>
            ) : (
              s.last_instr
            )}
          </TableCell>
        </>
      ) : (
        <TableCell colSpan={3} className={cn(TD_CLS, "border-l text-muted-foreground")}>
          Henüz uçuş yok
        </TableCell>
      )}

      {card.pplDur > 0 ? (
        <>
          <TableCell className={cn(NUM_CLS, "border-l")}>{hatDurumuFmtMin(card.curriculum)}</TableCell>
          <TableCell className={NUM_CLS}>{hatDurumuFmtMin(card.extraMin)}</TableCell>
          <TableCell className={cn(NUM_CLS, "font-semibold", KALAN_CLS[card.kalanClass])}>
            {hatDurumuFmtMin(card.remaining)}
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className={cn(NUM_CLS, "border-l")}><Dash /></TableCell>
          <TableCell className={NUM_CLS}><Dash /></TableCell>
          <TableCell className={NUM_CLS}><Dash /></TableCell>
        </>
      )}

      <TableCell className={cn(NUM_CLS, "border-l")}>{card.e1Text}</TableCell>
      <TableCell className={NUM_CLS}>{card.stageText}</TableCell>
    </TableRow>
  );
}

export default function HatDurumuPpl({ data }: { data: HatPplPageData }) {
  const { filters, options, columns, studentCount, grandTotalRem } = data;
  const corpFilterActive = filters.corpFormSubmitted ? filters.activeCorpIds.length > 0 : true;
  const corpSummary = corpFilterActive
    ? `Kurumsal etiketler · ${filters.activeCorpIds.length} seçili`
    : "Kurumsal etiketler · kapalı (tüm öğrenciler)";

  return (
    <PageShell className="print:gap-2 print:p-0">
      <PageHeader
        title="Hat durumu — PPL"
        description={
          <>
            Uçuş aşamalarına göre PPL öğrencileri ·{" "}
            <strong className="font-semibold text-foreground tabular-nums">{studentCount}</strong> öğrenci
            {grandTotalRem > 0 && (
              <>
                {" "}
                · toplam kalan{" "}
                <strong className="font-semibold text-foreground tabular-nums">{hatDurumuFmtMin(grandTotalRem)}</strong>
              </>
            )}
          </>
        }
      >
        <HatDurumuPplPrint />
      </PageHeader>

      {studentCount > 0 && (
        <nav aria-label="Aşama özeti" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7 print:hidden">
          {columns.map((col) => (
            <a
              key={col.key}
              href={`#asama-${col.key}`}
              className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-card px-3 py-2.5 ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="size-2 shrink-0 rounded-full" style={{ background: col.color }} aria-hidden />
                <span className="truncate">{col.label}</span>
              </span>
              <span className="text-lg leading-tight font-semibold tabular-nums">{col.cards.length}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {col.remainingMin > 0 ? `Kalan ${hatDurumuFmtMin(col.remainingMin)}` : "Kalan süre yok"}
              </span>
            </a>
          ))}
        </nav>
      )}

      <Card size="sm" className="print:hidden">
        <CardContent className="flex flex-col gap-3">
          <form method="get" action="/hat-durumu-ppl" role="search" className="flex flex-col gap-3">
            <KeepQuery filters={filters} except={["q", "fleet", "facility", "group", "student", "grad", "susp", "exclude_ppl_grad"]} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="hat-q" className="text-xs text-muted-foreground">Ara</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="hat-q"
                    type="search"
                    name="q"
                    className="pl-8"
                    defaultValue={filters.q}
                    placeholder="Kısa kod, ad, soyad…"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="hat-fleet" className="text-xs text-muted-foreground">Filo</Label>
                <select id="hat-fleet" name="fleet" className={SELECT_CLS} defaultValue={String(filters.fleet)}>
                  <option value="0">(tümü)</option>
                  {options.fleets.map((fl) => (
                    <option key={fl.m_ID} value={fl.m_ID}>
                      {fl.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="hat-facility" className="text-xs text-muted-foreground">Tesis</Label>
                <select id="hat-facility" name="facility" className={SELECT_CLS} defaultValue={String(filters.facility)}>
                  <option value="0">(tümü)</option>
                  {options.facilities.map((fc) => (
                    <option key={fc.m_ID} value={fc.m_ID}>
                      {fc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="hat-group" className="text-xs text-muted-foreground">Grup</Label>
                <select id="hat-group" name="group" className={SELECT_CLS} defaultValue={String(filters.group)}>
                  <option value="0">(tümü)</option>
                  {options.groups.map((g) => {
                    const glab = `${g.fleet_name ?? ""} — ${g.code}`.trim();
                    return (
                      <option key={g.m_ID} value={g.m_ID}>
                        {glab !== "—" ? glab : g.code}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="hat-student" className="text-xs text-muted-foreground">Öğrenci</Label>
                <select id="hat-student" name="student" className={SELECT_CLS} defaultValue={String(filters.student)}>
                  <option value="0">(tümü)</option>
                  {options.students.map((sp) => (
                    <option key={sp.m_ID} value={sp.m_ID}>
                      {`${sp.lastName} ${sp.firstName}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Label className="font-normal">
                <input type="checkbox" name="grad" value="1" className={CHECK_CLS} defaultChecked={filters.showGraduates} />
                Mezunları göster
              </Label>
              <Label className="font-normal">
                <input type="hidden" name="susp" value="0" />
                <input type="checkbox" name="susp" value="1" className={CHECK_CLS} defaultChecked={filters.showSuspended} />
                Uçuşu askıya alınanlar
              </Label>
              <Label className="font-normal">
                <input type="hidden" name="exclude_ppl_grad" value="0" />
                <input
                  type="checkbox"
                  name="exclude_ppl_grad"
                  value="1"
                  className={CHECK_CLS}
                  defaultChecked={filters.excludePplGrads}
                />
                PPL mezunlarını listeden çıkar
              </Label>
              <div className="ml-auto flex items-center gap-2">
                <Link href="/hat-durumu-ppl" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  <FilterX aria-hidden />
                  Temizle
                </Link>
                <Button type="submit" size="sm">Uygula</Button>
              </div>
            </div>
          </form>

          <details className="group border-t pt-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md text-sm font-medium outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              <Tags className="size-4 text-muted-foreground" aria-hidden />
              <span>{corpSummary}</span>
              <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <form method="get" action="/hat-durumu-ppl" className="flex flex-col gap-3 pt-3">
              <input type="hidden" name="corp_form" value="1" />
              <KeepQuery filters={filters} except={["corp"]} />
              {options.corpLabelsCore.length === 0 && options.corpLabelsExtra.length === 0 ? (
                <p className="text-sm text-muted-foreground">Gösterilecek kurumsal etiket yok.</p>
              ) : (
                <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {options.corpLabelsCore.map((cl) => (
                    <CorpCheck key={cl.m_ID} label={cl} checked={filters.activeCorpIds.includes(cl.m_ID)} />
                  ))}
                </div>
              )}
              {options.corpLabelsExtra.length > 0 && (
                <details className="border-t pt-2">
                  <summary className="w-fit cursor-pointer rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                    Diğer etiketler ({options.corpLabelsExtra.length})
                  </summary>
                  <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 pt-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {options.corpLabelsExtra.map((cl) => (
                      <CorpCheck key={cl.m_ID} label={cl} checked={filters.activeCorpIds.includes(cl.m_ID)} />
                    ))}
                  </div>
                </details>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm">Etiketlerle filtrele</Button>
                <Link href="/hat-durumu-ppl" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  <FilterX aria-hidden />
                  Temizle
                </Link>
              </div>
            </form>
          </details>
        </CardContent>
      </Card>

      {studentCount === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <SearchX className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Öğrenci bulunamadı</p>
            <p className="text-sm text-muted-foreground">Arama veya filtreleri değiştirip yeniden deneyin.</p>
            <Link href="/hat-durumu-ppl" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "print:hidden")}>
              <FilterX aria-hidden />
              Filtreleri temizle
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div
          className="max-h-[calc(100dvh-9rem)] min-w-0 overflow-auto rounded-xl bg-card ring-1 ring-foreground/10 [contain:inline-size] [print-color-adjust:exact] print:max-h-none print:overflow-visible print:rounded-none print:ring-0 print:[contain:none] [&_[data-slot=table-container]]:overflow-visible"
          role="region"
          aria-label="Hat durumu tablosu"
          tabIndex={0}
        >
          <Table className="min-w-[1120px] text-xs print:min-w-0 print:text-[8px]">
            <TableHeader className="sticky top-0 z-10 print:static [&_tr]:border-b-0">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className={cn(TH_CLS, "w-8 text-right")}>#</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "min-w-44 print:min-w-0")}>Ad soyad</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, SCREEN_ONLY)}>StPL no</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, SCREEN_ONLY)} title="Nazari sınav durumu">Nazari</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, SCREEN_ONLY)} title="PPL müfredat revizyonu">Rev</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "border-l")}>Son uçuş</TableHead>
                <TableHead scope="col" className={TH_CLS}>Görev</TableHead>
                <TableHead scope="col" className={TH_CLS}>Öğretmen</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "border-l text-right")} title="Müfredat kapsamında uçulan süre">Uçulan</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "text-right")}>Extra</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "text-right")} title="Plan − uçulan">Kalan</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "border-l text-right")} title="İlk E-1 uçuşundan bu yana geçen gün">E-1’den beri</TableHead>
                <TableHead scope="col" className={cn(TH_CLS, "text-right")} title="Bulunduğu aşamaya girdiğinden bu yana geçen gün">Bu aşamada</TableHead>
              </TableRow>
            </TableHeader>
            {columns.map((col) => (
              <TableBody key={col.key} data-stage={col.key} className="border-b last:border-b-0">
                <TableRow id={`asama-${col.key}`} className="scroll-mt-9 bg-muted/50 hover:bg-muted/50 print:break-after-avoid">
                  <TableHead colSpan={COLSPAN} scope="colgroup" className="h-auto px-2 py-1.5 print:px-1 print:py-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: col.color }} aria-hidden />
                      <span className="text-xs font-semibold tracking-wide print:text-[9px]">{col.label}</span>
                      <Badge variant="secondary" className="tabular-nums print:h-auto print:px-1 print:py-0 print:text-[8px]">
                        {col.cards.length} öğrenci
                      </Badge>
                      {col.cards.length > 0 && col.remainingMin > 0 && (
                        <span className="ml-auto text-xs font-normal text-muted-foreground print:text-[8px]">
                          Toplam kalan{" "}
                          <strong className="font-semibold text-foreground tabular-nums">{hatDurumuFmtMin(col.remainingMin)}</strong>
                        </span>
                      )}
                    </div>
                  </TableHead>
                </TableRow>
                {col.cards.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLSPAN} className={cn(TD_CLS, "text-muted-foreground")}>
                      Bu aşamada öğrenci yok
                    </TableCell>
                  </TableRow>
                ) : (
                  col.cards.map((card, i) => <StudentRow key={card.student.m_ID} card={card} index={i} stageKey={col.key} />)
                )}
              </TableBody>
            ))}
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className={TD_CLS}></TableCell>
                <TableHead scope="row" className="h-auto px-2 py-1.5 align-top text-xs font-semibold print:px-1 print:py-0.5 print:text-[8px]">
                  Toplam · <span className="tabular-nums">{studentCount}</span> öğrenci
                </TableHead>
                <TableCell colSpan={3} className={cn(TD_CLS, SCREEN_ONLY)}></TableCell>
                <TableCell colSpan={3} className={cn(TD_CLS, "border-l")}></TableCell>
                <TableCell colSpan={2} className={cn(TD_CLS, "border-l")}></TableCell>
                <TableCell className={cn(NUM_CLS, "font-semibold")}>
                  {grandTotalRem > 0 ? hatDurumuFmtMin(grandTotalRem) : <Dash />}
                </TableCell>
                <TableCell colSpan={2} className={cn(TD_CLS, "border-l")}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </PageShell>
  );
}
