import { NextRequest, NextResponse } from "next/server";
import { requireApiModule } from "@/lib/odt-yetki";
import { getOgrenciList, getFilters } from "@/lib/ogrenci";

export async function GET(req: NextRequest) {
  const gate = await requireApiModule("liste");
  if ("response" in gate) return gate.response;

  const sp = req.nextUrl.searchParams;
  const fleet = sp.get("fleet") ? Number(sp.get("fleet")) : undefined;
  const facility = sp.get("facility") ?? undefined;
  const group = sp.get("group") ?? undefined;
  const corp = sp.getAll("corp").map(Number).filter(Boolean);
  const search = sp.get("search") ?? undefined;

  const [rows, filters] = await Promise.all([
    getOgrenciList({ fleet, facility, group, corp: corp.length ? corp : undefined, search }),
    getFilters(),
  ]);

  return NextResponse.json({ rows, filters });
}
