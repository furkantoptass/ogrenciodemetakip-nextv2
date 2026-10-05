import { NextRequest, NextResponse } from "next/server";
import { requireApiModule } from "@/lib/odt-yetki";
import { cekVeYaz, seoCronYerel } from "@/lib/seo-kayit";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 401 });
  }

  try {
    const out = await cekVeYaz({ yalnizYoksa: true });
    return NextResponse.json({ ...out, skipped: out.skipped === true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Çekilemedi" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireApiModule("seo");
  const cron = "response" in gate && seoCronYerel(req);
  if ("response" in gate && !cron) return gate.response;

  let yalnizYoksa = false;
  try {
    const body = (await req.json()) as { yalnizYoksa?: unknown };
    yalnizYoksa = body.yalnizYoksa === true;
  } catch {
    yalnizYoksa = cron;
  }

  try {
    const out = await cekVeYaz({ yalnizYoksa: cron ? true : yalnizYoksa });
    return NextResponse.json({
      ok: true,
      skipped: out.skipped === true,
      gun: out.gun,
      postsN: out.postsN,
      pagesN: out.pagesN,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Çekilemedi" }, { status: 502 });
  }
}
