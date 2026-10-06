import { NextRequest, NextResponse } from "next/server";
import { saatYaz, ucusPaylasim } from "@/lib/paylasim";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const gelen = req.headers.get("authorization") ?? "";
  if (!secret || gelen !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Anahtar yok" }, { status: 401 });
  }

  const konu = (req.nextUrl.searchParams.get("konu") ?? "").trim().toLowerCase();
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
