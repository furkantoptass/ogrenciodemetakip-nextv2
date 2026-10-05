import { requirePageModule } from "@/lib/odt-yetki";
import SeoPanel from "@/components/SeoPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "SEO" };

export default async function SeoPage() {
  await requirePageModule("seo");
  return <SeoPanel />;
}
