import { rows as dbRows, run } from "./db";
import { listChannels } from "./desk360";
import { fetchCdrAdet, istanbulAralikUtc, istanbulBugun } from "./verimor";
import { wpGet, wpToplam } from "./wp";

export const KAYNAK_LISTESI = [
  { id: "naeron", label: "Naeron" },
  { id: "sozlesme", label: "Sözleşme" },
  { id: "ucus", label: "Uçuş" },
  { id: "formlar", label: "Formlar" },
  { id: "aramalar", label: "Arama" },
  { id: "wapi", label: "WAPI" },
  { id: "seo", label: "SEO" },
  { id: "google", label: "Google" },
  { id: "site", label: "Site" },
  { id: "kayit", label: "Kayıt" },
] as const;

export type KaynakId = (typeof KAYNAK_LISTESI)[number]["id"];

export type KaynakSonuc = {
  id: KaynakId;
  label: string;
  ok: boolean;
  ozet: string | null;
  error: string | null;
  at: string;
};

const TIMEOUT_MS = 12000;

function kisaHata(e: unknown): string {
  const s = e instanceof Error ? e.message : "Hata";
  return s.replace(/\s+/g, " ").trim().slice(0, 180);
}

function adet(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(n);
}

function withTimeout<T>(is: () => Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Zaman doldu")), ms);
    is().then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function olc(is: () => Promise<string>): Promise<{ ok: boolean; ozet: string | null; error: string | null }> {
  try {
    const ozet = await withTimeout(is, TIMEOUT_MS);
    return { ok: true, ozet, error: null };
  } catch (e) {
    return { ok: false, ozet: null, error: kisaHata(e) };
  }
}

async function say(fn: string): Promise<number> {
  const rows = await dbRows<{ c: unknown }>(fn);
  const n = Number(rows[0]?.c ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function httpGet(url: string): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.arrayBuffer();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Zaman doldu");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function siteAdi(): string {
  const base = (process.env.WP_BASE_URL || "https://northfly.aero/wp-json").replace(/\/wp-json\/?$/i, "");
  const origin = base.replace(/\/$/, "") || "https://northfly.aero";
  try {
    return new URL(origin.startsWith("http") ? origin : `https://${origin}`).hostname;
  } catch {
    return "northfly.aero";
  }
}

async function pingNaeron(): Promise<string> {
  const n = await say("odt_kaynak_ogrenci_sayisi");
  return `${adet(n)} öğrenci`;
}

async function pingSozlesme(): Promise<string> {
  const n = await say("odt_kaynak_sozlesme_sayisi");
  return `${adet(n)} sözleşme`;
}

async function pingUcus(): Promise<string> {
  const n = await say("odt_kaynak_ucus_sayisi");
  return `${adet(n)} uçuş`;
}

async function pingFormlar(): Promise<string> {
  const forms = await wpGet<unknown[]>("/wpforms/v1/forms");
  const n = Array.isArray(forms) ? forms.length : 0;
  return `${adet(n)} form`;
}

async function pingAramalar(): Promise<string> {
  const gun = istanbulBugun();
  const { from, to } = istanbulAralikUtc(gun, gun);
  const n = await fetchCdrAdet(from, to);
  return `bugün ${adet(n)} arama`;
}

async function pingWapi(): Promise<string> {
  const hats = await listChannels();
  return `${adet(hats.length)} hat`;
}

async function pingSeo(): Promise<string> {
  const n = await wpToplam("/wp/v2/posts");
  return `${adet(n)} yazı`;
}

async function pingGoogle(): Promise<string> {
  if (!process.env.GOOGLE_CLIENT_ID?.trim()) throw new Error("Google anahtarı yok");
  await httpGet("https://accounts.google.com/.well-known/openid-configuration");
  return "giriş açık";
}

async function pingSite(): Promise<string> {
  const host = siteAdi();
  const base = (process.env.WP_BASE_URL || "https://northfly.aero/wp-json").replace(/\/wp-json\/?$/i, "");
  const origin = base.replace(/\/$/, "") || "https://northfly.aero";
  await httpGet(origin.startsWith("http") ? origin : `https://${origin}`);
  return `${host} açık`;
}

async function pingKayit(): Promise<string> {
  const n = await say("odt_kaynak_kayit_sayisi");
  return `${adet(n)} kişi`;
}

const PING: Record<KaynakId, () => Promise<string>> = {
  naeron: pingNaeron,
  sozlesme: pingSozlesme,
  ucus: pingUcus,
  formlar: pingFormlar,
  aramalar: pingAramalar,
  wapi: pingWapi,
  seo: pingSeo,
  google: pingGoogle,
  site: pingSite,
  kayit: pingKayit,
};

function isoNow(): string {
  return new Date().toISOString();
}

function isoFromDb(v: Date | string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}T${p(v.getUTCHours())}:${p(v.getUTCMinutes())}:${p(v.getUTCSeconds())}+03:00`;
  }
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (m) return `${m[1]}T${m[2]}+03:00`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? isoNow() : d.toISOString();
}

export async function sonKaynakSonuclari(): Promise<{ results: KaynakSonuc[]; lastAt: string | null }> {
  const rows = await dbRows<{
    source_id: string;
    checked_at: Date | string;
    ok: unknown;
    error_text: string | null;
    ozet: string | null;
  }>("odt_kaynak_list");
  const byId = new Map(rows.map((r) => [r.source_id, r]));
  let lastAt: string | null = null;
  const results: KaynakSonuc[] = KAYNAK_LISTESI.map((k) => {
    const r = byId.get(k.id);
    if (!r) {
      return { id: k.id, label: k.label, ok: false, ozet: null, error: null, at: "" };
    }
    const at = isoFromDb(r.checked_at);
    if (!lastAt || at > lastAt) lastAt = at;
    const ok = r.ok === true || r.ok === 1 || r.ok === "1";
    return {
      id: k.id,
      label: k.label,
      ok,
      ozet: r.ozet,
      error: r.error_text,
      at,
    };
  });
  return { results, lastAt };
}

export function kaynakEski(lastAt: string | null, dakika = 55): boolean {
  if (!lastAt) return true;
  const t = new Date(lastAt).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t > dakika * 60 * 1000;
}

export async function kaynaklariDene(): Promise<{ results: KaynakSonuc[]; lastAt: string }> {
  const at = isoNow();
  const settled = await Promise.all(
    KAYNAK_LISTESI.map(async (k) => {
      const o = await olc(PING[k.id]);
      return { id: k.id, label: k.label, ...o, at };
    })
  );
  for (const r of settled) {
    // isoFromDb() okunan saati +03:00 (İstanbul) kabul eder; bu yüzden İstanbul duvar saati yazılır.
    await run("odt_kaynak_upsert", {
      p_source_id: r.id,
      p_ok: r.ok,
      p_error_text: r.error,
      p_ozet: r.ozet,
    });
  }
  return { results: settled, lastAt: at };
}
