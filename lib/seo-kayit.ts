import { rows as q, run } from "./db";
import { wpGetPaged, type WpSeoRow } from "./wp";

export type SeoKind = "posts" | "pages";

export type SeoSatir = {
  id: number;
  link: string;
  title: string;
  score: number | null;
  keyword: string;
  seoTitle: string;
  description: string;
};

export type SeoOzet = {
  gun: string | null;
  adet: number;
  ortalama: number | null;
  zayif: number;
  orta: number;
  iyi: number;
  puanYukselen: number;
  puanDusen: number;
  yeni: number;
  cikan: number;
};

export type SeoMadde = {
  title: string;
  link: string;
  ne: string;
};

export type SeoGun = {
  gun: string;
  maddeler: SeoMadde[];
};

type DbRow = {
  run_date: Date | string;
  kind: string;
  wp_id: unknown;
  link: string | null;
  title: string | null;
  score: unknown;
  keyword: string | null;
  seo_title: string | null;
  description: string | null;
};

function n(v: unknown): number {
  return typeof v === "bigint" ? Number(v) : Number(v);
}

function asYmd(v: Date | string): string {
  if (typeof v === "string") {
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : v.slice(0, 10);
  }
  const y = v.getUTCFullYear();
  const m = String(v.getUTCMonth() + 1).padStart(2, "0");
  const d = String(v.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function istanbulBugun(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function ymdGecerli(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function mapWp(r: WpSeoRow): SeoSatir {
  const title = r.title?.raw || r.title?.rendered || "";
  const scoreRaw = r.rank_math_seo_score;
  const score = scoreRaw === "" || scoreRaw == null ? null : Number(scoreRaw);
  return {
    id: r.id,
    link: r.link || "",
    title,
    score: Number.isFinite(score) ? score : null,
    keyword: r.rank_math_focus_keyword || "",
    seoTitle: r.rank_math_title || "",
    description: r.rank_math_description || "",
  };
}

function mapDb(r: DbRow): SeoSatir {
  const score = r.score == null || r.score === "" ? null : Number(r.score);
  return {
    id: n(r.wp_id),
    link: r.link || "",
    title: r.title || "",
    score: Number.isFinite(score) ? score : null,
    keyword: r.keyword || "",
    seoTitle: r.seo_title || "",
    description: r.description || "",
  };
}

async function fetchKind(kind: SeoKind): Promise<SeoSatir[]> {
  const path =
    kind === "pages"
      ? "/wp/v2/pages?context=edit&_fields=id,title,link,rank_math_seo_score,rank_math_focus_keyword"
      : "/wp/v2/posts?context=edit&_fields=id,title,link,rank_math_seo_score,rank_math_focus_keyword,rank_math_title,rank_math_description";
  const rows = await wpGetPaged<WpSeoRow>(path, 100, 10);
  return rows.map(mapWp);
}

async function insertRows(gun: string, kind: SeoKind, list: SeoSatir[]): Promise<void> {
  const chunk = 500;
  for (let i = 0; i < list.length; i += chunk) {
    const part = list.slice(i, i + chunk);
    await run("odt_seo_rows_insert", {
      p_run_date: gun,
      p_kind: kind,
      p_rows: part.map((r) => ({
        wp_id: r.id,
        link: r.link.slice(0, 500),
        title: r.title.slice(0, 250),
        score: r.score,
        keyword: r.keyword.slice(0, 190),
        seo_title: r.seoTitle.slice(0, 250),
        description: r.description.slice(0, 500),
      })),
    });
  }
}

export async function bugunCekimOk(): Promise<boolean> {
  const gun = istanbulBugun();
  const rows = await q<{ ok: unknown }>("odt_seo_run_ok", { p_run_date: gun });
  return rows[0]?.ok === true;
}

export async function cekVeYaz(opts?: { yalnizYoksa?: boolean }): Promise<{
  ok: boolean;
  skipped?: boolean;
  gun: string;
  postsN: number;
  pagesN: number;
}> {
  const gun = istanbulBugun();
  if (opts?.yalnizYoksa && (await bugunCekimOk())) {
    return { ok: true, skipped: true, gun, postsN: 0, pagesN: 0 };
  }

  await run("odt_seo_run_start", { p_run_date: gun });

  try {
    const posts = await fetchKind("posts");
    const pages = await fetchKind("pages");
    await run("odt_seo_rows_delete", { p_run_date: gun });
    await insertRows(gun, "posts", posts);
    await insertRows(gun, "pages", pages);
    await run("odt_seo_run_finish", { p_run_date: gun, p_posts_n: posts.length, p_pages_n: pages.length });
    return { ok: true, gun, postsN: posts.length, pagesN: pages.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 250) : "Çekilemedi";
    await run("odt_seo_run_fail", { p_run_date: gun, p_error_text: msg });
    throw e;
  }
}

function byId(list: SeoSatir[]): Map<number, SeoSatir> {
  const m = new Map<number, SeoSatir>();
  for (const r of list) m.set(r.id, r);
  return m;
}

function ozetDurum(list: SeoSatir[]): Pick<SeoOzet, "adet" | "ortalama" | "zayif" | "orta" | "iyi"> {
  let toplam = 0;
  let say = 0;
  let zayif = 0;
  let orta = 0;
  let iyi = 0;
  for (const r of list) {
    if (r.score == null) {
      zayif += 1;
      continue;
    }
    toplam += r.score;
    say += 1;
    if (r.score < 40) zayif += 1;
    else if (r.score < 70) orta += 1;
    else iyi += 1;
  }
  return {
    adet: list.length,
    ortalama: say ? Math.round((toplam / say) * 10) / 10 : null,
    zayif,
    orta,
    iyi,
  };
}

function hareket(onceki: Map<number, SeoSatir>, sonraki: Map<number, SeoSatir>): Pick<
  SeoOzet,
  "puanYukselen" | "puanDusen" | "yeni" | "cikan"
> {
  let puanYukselen = 0;
  let puanDusen = 0;
  let yeni = 0;
  let cikan = 0;
  for (const [id, a] of sonraki) {
    const b = onceki.get(id);
    if (!b) {
      yeni += 1;
      continue;
    }
    const eski = b.score;
    const yeniP = a.score;
    if ((eski ?? -1) < (yeniP ?? -1) && (eski != null || yeniP != null) && eski !== yeniP) puanYukselen += 1;
    if ((eski ?? -1) > (yeniP ?? -1) && (eski != null || yeniP != null) && eski !== yeniP) puanDusen += 1;
  }
  for (const id of onceki.keys()) {
    if (!sonraki.has(id)) cikan += 1;
  }
  return { puanYukselen, puanDusen, yeni, cikan };
}

function farkSatir(onceki: SeoSatir | undefined, sonraki: SeoSatir | undefined, kind: SeoKind): string | null {
  const etiket = kind === "pages" ? "sayfa" : "yazı";
  if (!onceki && sonraki) return `yeni ${etiket}`;
  if (onceki && !sonraki) return "listeden çıktı";
  if (!onceki || !sonraki) return null;
  const parca: string[] = [];
  if (onceki.score !== sonraki.score) {
    parca.push(`puan ${onceki.score ?? "—"} → ${sonraki.score ?? "—"}`);
  }
  if (onceki.keyword !== sonraki.keyword) parca.push("odak kelime değişti");
  if (onceki.seoTitle !== sonraki.seoTitle) parca.push("SEO başlığı değişti");
  if (onceki.description !== sonraki.description) parca.push("açıklama değişti");
  if (onceki.title !== sonraki.title) parca.push("başlık değişti");
  return parca.length ? parca.join(" · ") : null;
}

function gunFark(onceki: SeoSatir[], sonraki: SeoSatir[], kind: SeoKind): SeoMadde[] {
  const a = byId(onceki);
  const b = byId(sonraki);
  const out: SeoMadde[] = [];
  const ids = new Set<number>([...a.keys(), ...b.keys()]);
  for (const id of ids) {
    const eski = a.get(id);
    const yeniS = b.get(id);
    const ne = farkSatir(eski, yeniS, kind);
    if (!ne) continue;
    const src = yeniS || eski;
    out.push({
      title: src?.title || src?.link || `#${id}`,
      link: src?.link || "",
      ne,
    });
  }
  out.sort((x, y) => x.title.localeCompare(y.title, "tr"));
  return out;
}

async function satirlar(gun: string, kind: SeoKind): Promise<SeoSatir[]> {
  const rows = await q<DbRow>("odt_seo_rows_list", { p_run_date: gun, p_kind: kind });
  return rows.map(mapDb);
}

export async function tarihce(
  from: string,
  to: string,
  kind: SeoKind
): Promise<{ ozet: SeoOzet; gunler: SeoGun[]; kayitGunleri: string[]; sonCekim: string | null }> {
  let a = from;
  let b = to;
  if (a > b) {
    const t = a;
    a = b;
    b = t;
  }

  const okGunler = await q<{ run_date: Date | string }>("odt_seo_ok_days", { p_from: a, p_to: b });
  const kayitGunleri = okGunler.map((r) => asYmd(r.run_date));

  const sonRun = await q<{ run_date: Date | string; finished_at: Date | string | null }>("odt_seo_last_ok_run");
  const sonCekim = sonRun[0]?.finished_at
    ? sonRun[0].finished_at instanceof Date
      ? sonRun[0].finished_at.toISOString()
      : String(sonRun[0].finished_at)
    : null;

  const bosOzet: SeoOzet = {
    gun: null,
    adet: 0,
    ortalama: null,
    zayif: 0,
    orta: 0,
    iyi: 0,
    puanYukselen: 0,
    puanDusen: 0,
    yeni: 0,
    cikan: 0,
  };

  if (kayitGunleri.length === 0) {
    return { ozet: bosOzet, gunler: [], kayitGunleri, sonCekim };
  }

  const oncekiSatir = await q<{ run_date: Date | string }>("odt_seo_prev_ok_day", { p_before: kayitGunleri[0] });
  const oncekiGun = oncekiSatir[0] ? asYmd(oncekiSatir[0].run_date) : null;

  const cache = new Map<string, SeoSatir[]>();
  async function forGun(g: string): Promise<SeoSatir[]> {
    const hit = cache.get(g);
    if (hit) return hit;
    const list = await satirlar(g, kind);
    cache.set(g, list);
    return list;
  }

  const sonGun = kayitGunleri[kayitGunleri.length - 1];
  const sonListe = await forGun(sonGun);
  const durum = ozetDurum(sonListe);
  const baslangicGun = oncekiGun || kayitGunleri[0];
  const baslangicListe = await forGun(baslangicGun);
  const har =
    oncekiGun || kayitGunleri.length > 1
      ? hareket(byId(baslangicListe), byId(sonListe))
      : { puanYukselen: 0, puanDusen: 0, yeni: 0, cikan: 0 };

  const ozet: SeoOzet = { gun: sonGun, ...durum, ...har };

  const zincir: string[] = oncekiGun ? [oncekiGun, ...kayitGunleri] : kayitGunleri;
  const gunler: SeoGun[] = [];
  for (let i = 1; i < zincir.length; i += 1) {
    const gun = zincir[i];
    const maddeler = gunFark(await forGun(zincir[i - 1]), await forGun(gun), kind);
    if (maddeler.length === 0) continue;
    gunler.push({ gun, maddeler });
  }

  return { ozet, gunler, kayitGunleri, sonCekim };
}

export function seoCronYerel(req: { headers: Headers }): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost") return false;
  const xf = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (!xf) return true;
  return xf === "127.0.0.1" || xf === "::1" || xf === "::ffff:127.0.0.1";
}
