import { requirePageModule } from "@/lib/odt-yetki";
import SuperPanel from "@/components/SuperPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yetkiler" };

export default async function SuperPage() {
  await requirePageModule("super");
  return <SuperPanel />;
}
