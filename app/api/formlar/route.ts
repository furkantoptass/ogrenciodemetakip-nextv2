import { NextRequest, NextResponse } from "next/server";
import { requireApiModule } from "@/lib/odt-yetki";
import { listKayitlar, setFormActive } from "@/lib/wp-formlar";

export async function GET(req: NextRequest) {
  const gate = await requireApiModule("formlar");
  if ("response" in gate) return gate.response;
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const formId = Number(req.nextUrl.searchParams.get("form") ?? 0);
  try {
    const data = await listKayitlar({ q, formId: formId > 0 ? formId : undefined });
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Okunamadı" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireApiModule("formlar");
  if ("response" in gate) return gate.response;
  let body: { formId?: number; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "İstek okunamadı" }, { status: 400 });
  }
  const formId = Number(body.formId);
  if (!formId || typeof body.active !== "boolean") {
    return NextResponse.json({ ok: false, error: "Form belirsiz" }, { status: 400 });
  }
  try {
    await setFormActive(formId, body.active);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Kaydedilemedi" }, { status: 500 });
  }
}
