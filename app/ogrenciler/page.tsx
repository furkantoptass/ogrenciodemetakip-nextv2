import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOgrenciList, getFilters, getCurrencyMap, getCorpLabelCounts, getStudentDropdownList } from "@/lib/ogrenci";
import { varsayilanAktifEtiketler } from "@/lib/corp-etiket";
import { aktifOkul } from "@/lib/okul-istek";
import { getOgrenciDetay } from "@/lib/ogrenci-detay";
import OgrenciTable from "@/components/OgrenciTable";
import { firstOpenHref, getYetki, hasModule } from "@/lib/odt-yetki";

export const dynamic = "force-dynamic";

function lastStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[v.length - 1];
  return typeof v === "string" ? v : undefined;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const yetki = await getYetki(session.user.email);
  if (!yetki || !yetki.active) redirect("/yetki-yok");
  if (!hasModule(yetki, "liste")) redirect(firstOpenHref(yetki));

  const sp = await searchParams;
  const fleetN = Number(lastStr(sp.fleet));
  const fleet = fleetN > 0 ? fleetN : undefined;
  const facility = lastStr(sp.facility) || undefined;
  const group = lastStr(sp.group) || undefined;
  const studentN = Number(lastStr(sp.student));
  const student = studentN > 0 ? studentN : undefined;
  const corpFormSubmitted = lastStr(sp.corp_form) === "1";
  const corpRaw = Array.isArray(sp.corp) ? sp.corp : sp.corp ? [sp.corp] : [];
  const corp = corpRaw.map(Number).filter((n) => n === -1 || n > 0);
  const search = lastStr(sp.q) || undefined;
  const grad = lastStr(sp.grad) === "1";
  const susp = lastStr(sp.susp) !== "0";
  const excludePplGrad = lastStr(sp.exclude_ppl_grad) === "1";
  const errMode = lastStr(sp.err_mode) === "1";
  const overdueOnly = lastStr(sp.overdue_only) === "1";
  const noteMode = lastStr(sp.note_mode) === "1";

  const activeCorpIds = corpFormSubmitted ? corp : varsayilanAktifEtiketler(await aktifOkul());

  const [rows, filters, { currencies, symbolMap }, corpCounts, studentDropdown, detay] = await Promise.all([
    getOgrenciList({ fleet, facility, group, student, corp: activeCorpIds, corpFormSubmitted, search, grad, susp, excludePplGrad }),
    getFilters(),
    getCurrencyMap(),
    getCorpLabelCounts(),
    getStudentDropdownList(),
    student ? getOgrenciDetay(student) : Promise.resolve(null),
  ]);

  return (
    <OgrenciTable
      initialRows={rows}
      filters={filters}
      currencies={currencies}
      symbolMap={symbolMap}
      corpCounts={corpCounts}
      studentDropdown={studentDropdown}
      currentFilters={{ fleet, facility, group, student, corp: activeCorpIds, corpFormSubmitted, search, grad, susp, excludePplGrad }}
      modes={{ errMode, overdueOnly, noteMode }}
      detay={detay}
    />
  );
}
