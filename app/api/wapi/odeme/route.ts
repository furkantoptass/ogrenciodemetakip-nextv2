import { NextRequest, NextResponse } from "next/server";
import { requireWapiUser } from "@/lib/wapi-auth";
import { getOdemeOgrenciDoldur, ODEME_MESAJLARI } from "@/lib/odeme-mesaj";

export async function GET(req: NextRequest) {
  const gate = await requireWapiUser();
  if ("response" in gate) return gate.response;
  const id = Number(req.nextUrl.searchParams.get("id") ?? 0);
  if (!id) return NextResponse.json({ ok: false, error: "Öğrenci yok" }, { status: 400 });
  try {
    const data = await getOdemeOgrenciDoldur(id);
    if (!data) return NextResponse.json({ ok: false, error: "Öğrenci bulunamadı" }, { status: 404 });
    return NextResponse.json({ ok: true, mesajlar: ODEME_MESAJLARI, ogrenci: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Okunamadı" }, { status: 500 });
  }
}
