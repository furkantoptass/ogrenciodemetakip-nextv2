import { NextRequest, NextResponse } from "next/server";
import { requireApiModule } from "@/lib/odt-yetki";
import { rows as dbRows, run } from "@/lib/db";

export async function POST(req: NextRequest) {
  const gate = await requireApiModule("liste");
  if ("response" in gate) return gate.response;
  const email = gate.email;

  let body: { studentId?: number; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "İstek okunamadı" }, { status: 400 });
  }
  const studentId = Number(body.studentId);
  const text = String(body.body ?? "").trim();
  if (!studentId || !text) return NextResponse.json({ ok: false, error: "Not boş" }, { status: 400 });
  if (text.length > 8000) return NextResponse.json({ ok: false, error: "Not çok uzun" }, { status: 400 });

  const author = (gate.yetki.name || email).slice(0, 190);
  try {
    const rows = await dbRows<{ id: number; body: string; created_at: Date; author_name: string }>("odt_not_insert", {
      p_student_id: studentId,
      p_body: text,
      p_author_name: author,
    });
    const r = rows[0];
    return NextResponse.json({
      ok: true,
      note: r
        ? {
            id: Number(r.id),
            body: r.body,
            createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
            authorName: r.author_name,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Kaydedilemedi" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireApiModule("liste");
  if ("response" in gate) return gate.response;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "Not yok" }, { status: 400 });
  try {
    await run("odt_not_delete", { p_id: id });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Silinemedi" }, { status: 500 });
  }
}
