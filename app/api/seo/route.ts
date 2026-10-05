import { NextRequest, NextResponse } from "next/server";
import { requireApiModule } from "@/lib/odt-yetki";
import { wpGetPaged, type WpSeoRow } from "@/lib/wp";

export const maxDuration = 60;

function yazi(r: WpSeoRow) {
  const title = r.title?.raw || r.title?.rendered || "";
  const scoreRaw = r.rank_math_seo_score;
  const score = scoreRaw === "" || scoreRaw == null ? null : Number(scoreRaw);
  return {
    id: r.id,
    link: r.link,
    title,
    score: Number.isFinite(score) ? score : null,
    keyword: r.rank_math_focus_keyword || "",
    seoTitle: r.rank_math_title || "",
    description: r.rank_math_description || "",
  };
}

export async function GET(req: NextRequest) {
  const gate = await requireApiModule("seo");
  if ("response" in gate) return gate.response;
  const kind = req.nextUrl.searchParams.get("kind") === "pages" ? "pages" : "posts";
  try {
    const path =
      kind === "pages"
        ? "/wp/v2/pages?context=edit&_fields=id,title,link,rank_math_seo_score,rank_math_focus_keyword"
        : "/wp/v2/posts?context=edit&_fields=id,title,link,rank_math_seo_score,rank_math_focus_keyword,rank_math_title,rank_math_description";
    const rows = await wpGetPaged<WpSeoRow>(path, 100, 10);
    const list = rows.map(yazi).sort((a, b) => (a.score ?? 999) - (b.score ?? 999));
    return NextResponse.json({ ok: true, kind, rows: list });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Okunamadı" }, { status: 502 });
  }
}
