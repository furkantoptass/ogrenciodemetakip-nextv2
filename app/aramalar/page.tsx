import { requirePageModule } from "@/lib/odt-yetki";
import AramalarPanel from "@/components/AramalarPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aramalar" };

export default async function AramalarPage() {
  await requirePageModule("aramalar");
  return <AramalarPanel />;
}
