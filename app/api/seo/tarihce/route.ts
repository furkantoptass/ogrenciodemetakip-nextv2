import { NextRequest, NextResponse } from "next/server";
import { requireApiModule } from "@/lib/odt-yetki";
import { istanbulBugun, tarihce, ymdGecerli, type SeoKind } from "@/lib/seo-kayit";

function kaydir(ymd: string, gun: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + gun);
  return dt.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const gate = await requireApiModule("seo");
  if ("response" in gate) return gate.response;

  const bugun = istanbulBugun();
  const fromRaw = String(req.nextUrl.searchParams.get("from") ?? "").trim();
  const toRaw = String(req.nextUrl.searchParams.get("to") ?? "").trim();
  const from = ymdGecerli(fromRaw) ? fromRaw : kaydir(bugun, -30);
  const to = ymdGecerli(toRaw) ? toRaw : bugun;
  const kind: SeoKind = req.nextUrl.searchParams.get("kind") === "pages" ? "pages" : "posts";

  try {
    const data = await tarihce(from, to, kind);
    return NextResponse.json({ ok: true, from, to, kind, ...data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Okunamadı" }, { status: 502 });
  }
}
