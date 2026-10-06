import { headers } from "next/headers";
import PaylasimPanel from "@/components/PaylasimPanel";
import { requirePageModule } from "@/lib/odt-yetki";
import { saatYaz, ucusPaylasim } from "@/lib/paylasim";

export const dynamic = "force-dynamic";
export const metadata = { title: "API" };

export default async function PaylasimPage() {
  await requirePageModule("paylasim");
  const u = await ucusPaylasim();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const adres = `${proto}://${host}/api/paylasim?konu=ucus`;

  return (
    <PaylasimPanel
      saat={saatYaz(u.dakika, true)}
      sorti={u.sorti}
      adres={adres}
      kilitVar={Boolean(process.env.CRON_SECRET?.trim())}
    />
  );
}
