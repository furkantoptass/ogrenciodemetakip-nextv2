import { NextRequest, NextResponse } from "next/server";
import { kodAcikMi, kodlarAyni } from "@/lib/api-kod";
import { saatYaz, ucusPaylasim } from "@/lib/paylasim";

export const dynamic = "force-dynamic";

function gelenKod(req: NextRequest): string {
  const gelen = req.headers.get("authorization") ?? "";
  const eslesen = /^Bearer\s+(\S+)$/i.exec(gelen);
  return eslesen?.[1]?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const token = gelenKod(req);
  const konu = (req.nextUrl.searchParams.get("konu") ?? "").trim().toLowerCase();
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  const gizli = secret ? kodlarAyni(token, secret) : false;
  if (!gizli) {
    try {
      if (!(await kodAcikMi(token, konu))) {
        return NextResponse.json({ ok: false, error: "Anahtar yok" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Kod okunamadı" }, { status: 502 });
    }
  }

  if (konu !== "ucus") {
    return NextResponse.json({ ok: false, error: "Bu konu yok" }, { status: 404 });
  }

  try {
    const u = await ucusPaylasim();
    return NextResponse.json({
      ok: true,
      konu: "ucus",
      saat: saatYaz(u.dakika),
      dakika: u.dakika,
      sorti: u.sorti,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Alınamadı" },
      { status: 502 },
    );
  }
}
