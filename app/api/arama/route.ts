import { NextRequest, NextResponse } from "next/server";
import { requireApiModule } from "@/lib/odt-yetki";
import { rows as dbRows } from "@/lib/db";

type PersonRow = {
  m_ID: unknown;
  firstName: string | null;
  lastName: string | null;
  shortCode: string | null;
  gsm: string | null;
};

type Hit = {
  kind: "ogrenci" | "ogretmen";
  id: number;
  name: string;
  extra: string;
  href: string | null;
};

function asId(v: unknown): number {
  return typeof v === "bigint" ? Number(v) : Number(v);
}

function kisiAd(r: PersonRow): string {
  return `${r.firstName ?? ""} ${r.lastName ?? ""}`.replace(/\s+/g, " ").trim();
}

function digits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export async function GET(req: NextRequest) {
  const gate = await requireApiModule("liste");
  if ("response" in gate) return gate.response;

  const q = String(req.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .slice(0, 40)
    .replace(/[%_\\]/g, "");
  if (q.length < 2) {
    return NextResponse.json({ ok: true, results: [] as Hit[] });
  }

  const like = `%${q}%`;

  try {
    const [students, employees] = await Promise.all([
      dbRows<PersonRow>("odt_arama_students", { p_like: like }),
      dbRows<PersonRow>("odt_arama_employees", { p_like: like }),
    ]);

    const codes = [...new Set(employees.map((e) => (e.shortCode ?? "").trim()).filter((c) => c.length > 0))];
    const gsmList = [...new Set(employees.map((e) => digits(e.gsm)).filter((g) => g.length >= 10))];
    const studentByCode = new Map<string, number>();
    const studentByGsm = new Map<string, number>();
    if (codes.length > 0 || gsmList.length > 0) {
      // MySQL'de karşılaştırma büyük/küçük harf duyarsızdı; burada UPPER ile korunur.
      const matched = await dbRows<PersonRow>("odt_arama_student_match", {
        p_codes: codes.map((c) => c.toUpperCase()),
        p_gsms: gsmList,
      });
      for (const s of matched) {
        const id = asId(s.m_ID);
        if (!id) continue;
        const code = (s.shortCode ?? "").trim().toUpperCase();
        if (code) studentByCode.set(code, id);
        const g = digits(s.gsm);
        if (g.length >= 10) studentByGsm.set(g, id);
      }
    }

    const results: Hit[] = [];
    for (const s of students) {
      const id = asId(s.m_ID);
      if (!id) continue;
      results.push({
        kind: "ogrenci",
        id,
        name: kisiAd(s) || `#${id}`,
        extra: (s.shortCode ?? "").trim(),
        href: `/ogrenciler?student=${id}`,
      });
    }
    for (const e of employees) {
      const id = asId(e.m_ID);
      if (!id) continue;
      const code = (e.shortCode ?? "").trim().toUpperCase();
      const studentId = (code && studentByCode.get(code)) || studentByGsm.get(digits(e.gsm)) || null;
      results.push({
        kind: "ogretmen",
        id,
        name: kisiAd(e) || `#${id}`,
        extra: (e.shortCode ?? "").trim(),
        href: studentId ? `/ogrenciler?student=${studentId}` : null,
      });
    }

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Arama yapılamadı" },
      { status: 500 }
    );
  }
}
