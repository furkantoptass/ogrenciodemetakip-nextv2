import { NextRequest, NextResponse } from "next/server";
import { requireApiModule } from "@/lib/odt-yetki";
import { naeronSyncState, syncNaeron } from "@/lib/naeron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function secenekler(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tables = (sp.get("tables") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return { full: sp.get("full") === "1", tables: tables.length ? tables : undefined };
}

async function calistir(req: NextRequest) {
  try {
    const out = await syncNaeron(secenekler(req));
    return NextResponse.json(out, { status: out.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Eşitlenemedi" }, { status: 502 });
  }
}

// Zamanlanmış görev / komut satırı: Authorization: Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 401 });
  }
  if (req.nextUrl.searchParams.get("state") === "1") {
    return NextResponse.json({ ok: true, state: await naeronSyncState() });
  }
  return calistir(req);
}

// Uygulama içinden: yalnızca süper yönetici.
export async function POST(req: NextRequest) {
  const gate = await requireApiModule("super");
  if ("response" in gate) return gate.response;
  return calistir(req);
}
