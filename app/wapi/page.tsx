import { requirePageModule } from "@/lib/odt-yetki";
import WapiPanel from "@/components/WapiPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "WhatsApp" };

export default async function WapiPage() {
  const yetki = await requirePageModule("wapi");
  return <WapiPanel userEmail={yetki.email} />;
}
