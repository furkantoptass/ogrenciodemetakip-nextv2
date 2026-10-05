import { requirePageModule } from "@/lib/odt-yetki";
import FormlarPanel from "@/components/FormlarPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Formlar" };

export default async function FormlarPage() {
  await requirePageModule("formlar");
  return <FormlarPanel />;
}
