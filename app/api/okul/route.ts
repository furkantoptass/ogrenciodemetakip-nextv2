import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getYetki } from "@/lib/odt-yetki";
import { okulMu } from "@/lib/okul";

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) {
    return NextResponse.json({ ok: false, error: "Giriş yok" }, { status: 401 });
  }
  const yetki = await getYetki(email);
  if (!yetki?.active) {
    return NextResponse.json({ ok: false, error: "Giriş yok" }, { status: 401 });
  }
  let body: { okul?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "İstek okunamadı" }, { status: 400 });
  }
  if (!okulMu(body.okul) || !yetki.okullar.includes(body.okul)) {
    return NextResponse.json({ ok: false, error: "Bu okulu açamazsınız" }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true, okul: body.okul });
  res.cookies.set("odt_okul", body.okul, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 400,
  });
  return res;
}
