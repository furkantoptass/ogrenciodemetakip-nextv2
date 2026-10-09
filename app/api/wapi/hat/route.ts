import { NextRequest, NextResponse } from "next/server";
import { requireWapiUser } from "@/lib/wapi-auth";
import { listChats, listTemplates, type Desk360Chat, type Desk360Template } from "@/lib/desk360";
import { listWapiSends } from "@/lib/wapi-log";

function hataYazi(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Hat bilgisi alınamadı";
}

async function birKezDaha<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

async function parca<T>(fn: () => Promise<T>, bos: T): Promise<{ data: T; error: string }> {
  try {
    return { data: await birKezDaha(fn), error: "" };
  } catch (e) {
    return { data: bos, error: hataYazi(e) };
  }
}

export async function GET(req: NextRequest) {
  const gate = await requireWapiUser();
  if ("response" in gate) return gate.response;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "Hat seçilmedi" }, { status: 400 });

  const [templatesR, chatsR, sends] = await Promise.all([
    parca<Desk360Template[]>(() => listTemplates(id), []),
    parca<Desk360Chat[]>(() => listChats(id), []),
    listWapiSends(id),
  ]);
  const error = [templatesR.error, chatsR.error].filter(Boolean).join(" ");
  return NextResponse.json({
    ok: !error,
    templates: templatesR.data,
    chats: chatsR.data,
    sends,
    templateError: templatesR.error,
    chatError: chatsR.error,
    error,
  });
}
