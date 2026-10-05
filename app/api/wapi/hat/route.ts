import { NextRequest, NextResponse } from "next/server";
import { requireWapiUser } from "@/lib/wapi-auth";
import { listChats, listTemplates } from "@/lib/desk360";
import { listWapiSends } from "@/lib/wapi-log";

export async function GET(req: NextRequest) {
  const gate = await requireWapiUser();
  if ("response" in gate) return gate.response;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "Hat seçilmedi" }, { status: 400 });
  try {
    const [templates, chats, sends] = await Promise.all([
      listTemplates(id),
      listChats(id),
      listWapiSends(id),
    ]);
    return NextResponse.json({ ok: true, templates, chats, sends });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Hat bilgisi alınamadı" }, { status: 502 });
  }
}
