import { NextRequest, NextResponse } from "next/server";
import { kodKapat, kodOlustur, kodlariListele } from "@/lib/api-kod";
import { requireApiModule } from "@/lib/odt-yetki";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireApiModule("paylasim");
  if ("response" in gate) return gate.response;

  let body: { action?: string; id?: string; tur?: string; isim?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "İstek okunamadı" }, { status: 400 });
  }

  try {
    const action = String(body.action ?? "");
    if (action === "yeni") await kodOlustur({ tur: String(body.tur ?? ""), isim: String(body.isim ?? "") });
    else if (action === "kapat") await kodKapat(String(body.id ?? ""));
    else return NextResponse.json({ ok: false, error: "Bu işlem yok" }, { status: 400 });
    return NextResponse.json({ ok: true, kodlar: await kodlariListele() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Kaydedilemedi" },
      { status: 502 },
    );
  }
}
