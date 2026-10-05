import { NextRequest, NextResponse } from "next/server";
import { requireApiModule } from "@/lib/odt-yetki";
import {
  fetchCdrs,
  istanbulAralikUtc,
  istanbulBugun,
  normalizeTarihAraligi,
  yonOzet,
  type VerimorYon,
} from "@/lib/verimor";

export const maxDuration = 120;

function asYon(raw: string): VerimorYon | undefined {
  if (raw === "inbound" || raw === "outbound" || raw === "internal") return raw;
  return undefined;
}

export async function GET(req: NextRequest) {
  const gate = await requireApiModule("aramalar");
  if ("response" in gate) return gate.response;

  const q = req.nextUrl.searchParams;
  const dateRaw = String(q.get("date") ?? "").trim();
  const fromRaw = String(q.get("from") ?? "").trim() || dateRaw;
  const toRaw = String(q.get("to") ?? "").trim() || fromRaw || istanbulBugun();
  const direction = asYon(String(q.get("direction") ?? "").trim());
  const { fromDate, toDate } = normalizeTarihAraligi(fromRaw, toRaw);

  try {
    const { from, to } = istanbulAralikUtc(fromDate, toDate);
    const cdrs = await fetchCdrs({ from, to, direction });
    let gelen = 0;
    let giden = 0;
    let kacan = 0;
    for (const c of cdrs) {
      const y = yonOzet(c.direction);
      if (y === "gelen") gelen += 1;
      if (y === "giden") giden += 1;
      if (c.missed) kacan += 1;
    }
    return NextResponse.json({
      ok: true,
      from: fromDate,
      to: toDate,
      rows: cdrs,
      ozet: { toplam: cdrs.length, gelen, giden, kacan },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Okunamadı";
    const status = msg.includes("geçersiz") || msg.includes("yok") ? 401 : 502;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
