import { requirePageModule } from "@/lib/odt-yetki";
import { getHatPplPageData, parseHatPplFilters } from "@/lib/hat-durumu-ppl";
import HatDurumuPpl from "@/components/HatDurumuPpl";
import "./hat-durumu-ppl-print.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hat Durumu — PPL" };

export default async function HatDurumuPplPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageModule("hat-ppl");
  const sp = await searchParams;
  const data = await getHatPplPageData(parseHatPplFilters(sp));
  return <HatDurumuPpl data={data} />;
}
