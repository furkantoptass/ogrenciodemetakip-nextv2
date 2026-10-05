import { NextRequest, NextResponse } from "next/server";
import { requireApiModule } from "@/lib/odt-yetki";
import { savePicTakipTarihler } from "@/lib/pic-takip";

export async function POST(req: NextRequest) {
  const gate = await requireApiModule("pic-takip");
  if ("response" in gate) return gate.response;

  let body: { studentId?: number; dates?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "İstek okunamadı" }, { status: 400 });
  }
  const studentId = Number(body.studentId);
  if (!studentId) return NextResponse.json({ ok: false, error: "Öğrenci yok" }, { status: 400 });
  const dates = String(body.dates ?? "");
  if (dates.length > 4000) return NextResponse.json({ ok: false, error: "Metin çok uzun" }, { status: 400 });

  try {
    await savePicTakipTarihler(studentId, dates);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Kaydedilemedi" }, { status: 500 });
  }
}
