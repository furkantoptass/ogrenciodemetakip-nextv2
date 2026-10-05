import { requirePageModule } from "@/lib/odt-yetki";
import { getPicTakipPageData } from "@/lib/pic-takip";
import PicTakip from "@/components/PicTakip";

export const dynamic = "force-dynamic";
export const metadata = { title: "PIC Takip" };

export default async function PicTakipPage() {
  await requirePageModule("pic-takip");
  const data = await getPicTakipPageData();
  return <PicTakip data={data} />;
}
