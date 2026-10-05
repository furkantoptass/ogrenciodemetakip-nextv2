import { NextResponse } from "next/server";
import { requireApiModule } from "@/lib/odt-yetki";
import { kaynaklariDene, sonKaynakSonuclari } from "@/lib/kaynak-saat";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const gate = await requireApiModule("super");
  if ("response" in gate) return gate.response;
  try {
    const data = await sonKaynakSonuclari();
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Okunamadı" }, { status: 500 });
  }
}

export async function POST() {
  const gate = await requireApiModule("super");
  if ("response" in gate) return gate.response;
  try {
    const data = await kaynaklariDene();
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Deneme bitti" }, { status: 502 });
  }
}
