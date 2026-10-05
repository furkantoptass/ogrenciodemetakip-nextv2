import { NextRequest, NextResponse } from "next/server";
import { createOdtUser, listOdtUsers, ODT_PAGE_MODULES, requireApiModule, saveOdtUser } from "@/lib/odt-yetki";

export async function GET() {
  const gate = await requireApiModule("super");
  if ("response" in gate) return gate.response;
  const users = await listOdtUsers();
  return NextResponse.json({
    ok: true,
    meId: gate.yetki.id,
    modules: ODT_PAGE_MODULES,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      active: u.active,
      isSuper: u.isSuper,
      modules: u.modules.filter((m) => m !== "super"),
    })),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireApiModule("super");
  if ("response" in gate) return gate.response;
  let body: {
    action?: string;
    email?: string;
    name?: string;
    userId?: number;
    modules?: string[];
    isSuper?: boolean;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "İstek okunamadı" }, { status: 400 });
  }
  const action = String(body.action ?? "");
  if (action === "create") {
    const res = await createOdtUser({
      actor: gate.yetki,
      email: String(body.email ?? ""),
      name: String(body.name ?? ""),
      modules: body.modules,
      isSuper: !!body.isSuper,
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: res.id });
  }
  if (action === "save") {
    const res = await saveOdtUser({
      actor: gate.yetki,
      userId: Number(body.userId),
      modules: body.modules,
      isSuper: !!body.isSuper,
      active: body.active !== false,
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "Bilinmeyen işlem" }, { status: 400 });
}
