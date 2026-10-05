import { NextRequest, NextResponse } from "next/server";
import { requireApiModule } from "@/lib/odt-yetki";
import { syncEntriesPage, syncFormsFromWp } from "@/lib/wp-formlar";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const gate = await requireApiModule("formlar");
  if ("response" in gate) return gate.response;
  let body: { page?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const page = Math.max(1, Number(body.page) || 1);
  try {
    let formSayisi = 0;
    if (page === 1) formSayisi = await syncFormsFromWp();
    const { n, bitti } = await syncEntriesPage(page);
    return NextResponse.json({ ok: true, page, n, bitti, formSayisi });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Çekilemedi" }, { status: 502 });
  }
}
