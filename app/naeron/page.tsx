import { requirePageModule } from "@/lib/odt-yetki";
import { okulAd, okulBaglanti } from "@/lib/okul";
import { aktifOkul } from "@/lib/okul-istek";
import { NAERON_TABLES, naeronSyncState } from "@/lib/naeron";
import NaeronPanel, { type NaeronDurum } from "@/components/NaeronPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Naeron Eşitleme" };

const ETIKET: Record<string, string> = {
  currencies: "Para birimleri",
  facilities: "Tesisler",
  corporate_labels: "Kurumsal etiketler",
  fleets: "Filolar",
  aircrafts_simulators: "Uçaklar ve simülatörler",
  trainings: "Eğitim türleri",
  groups: "Gruplar",
  employees: "Personel",
  students: "Öğrenciler",
  student_contracts: "Sözleşmeler",
  student_installments: "Taksitler",
  student_payments: "Ödemeler",
  student_trainings: "Öğrenci eğitimleri",
  student_certificates: "Sertifikalar",
  flights: "Uçuşlar",
};

function iso(v: Date | string | null): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(`${v}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default async function NaeronPage() {
  await requirePageModule("super");
  const state = await naeronSyncState();
  const byTable = new Map(state.map((s) => [s.table_name, s]));
  const durum: NaeronDurum[] = NAERON_TABLES.map((table) => {
    const s = byTable.get(table);
    return {
      table,
      label: ETIKET[table] ?? table,
      lastRunAt: s ? iso(s.last_run_at) : null,
      rowCount: s?.row_count ?? 0,
      ok: s ? s.ok : null,
      error: s?.error_text ?? null,
    };
  });
  const okul = await aktifOkul();
  return <NaeronPanel durum={durum} configured={Boolean(okulBaglanti(okul).key)} okulAd={okulAd(okul)} />;
}
