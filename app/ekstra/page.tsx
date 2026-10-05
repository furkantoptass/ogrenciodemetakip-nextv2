import { requirePageModule } from "@/lib/odt-yetki";
import { getCurrencyMap, getOgrenciList } from "@/lib/ogrenci";
import EkstraTable from "@/components/EkstraTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ekstra" };

export default async function EkstraPage() {
  await requirePageModule("ekstra");
  const [rows, { symbolMap }] = await Promise.all([
    getOgrenciList({ susp: true }),
    getCurrencyMap(),
  ]);
  return <EkstraTable rows={rows} symbolMap={symbolMap} />;
}
