export type VerimorYon = "inbound" | "outbound" | "internal";

export type VerimorCdr = {
  call_uuid: string;
  start_stamp: string;
  direction: string;
  caller_id_number: string;
  destination_number: string;
  duration: string;
  result: string;
  missed: boolean;
  recording_present: boolean;
};

type FetchCdrsOpts = {
  from: string;
  to: string;
  direction?: VerimorYon;
  limit?: number;
  page?: number;
};

function apiKey(): string {
  const k = process.env.VERIMOR_API_KEY?.trim();
  if (!k) throw new Error("Verimor API anahtarı yok");
  return k;
}

function apiBase(): string {
  return (process.env.VERIMOR_API_BASE || "https://api.bulutsantralim.com").replace(/\/$/, "");
}

function errorText(data: unknown, fallback: string): string {
  if (typeof data === "string" && data.trim()) return data.slice(0, 400);
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.error === "string") return o.error;
    if (typeof o.message === "string") return o.message;
    if (o.error && typeof o.error === "object") {
      const m = (o.error as { message?: unknown }).message;
      if (typeof m === "string") return m;
    }
  }
  return fallback;
}

function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

function mapCdr(raw: unknown): VerimorCdr | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const uuid = String(o.call_uuid ?? "").trim();
  if (!uuid) return null;
  return {
    call_uuid: uuid,
    start_stamp: String(o.start_stamp ?? ""),
    direction: String(o.direction ?? ""),
    caller_id_number: String(o.caller_id_number ?? ""),
    destination_number: String(o.destination_number ?? ""),
    duration: String(o.duration ?? ""),
    result: String(o.result ?? ""),
    missed: asBool(o.missed),
    recording_present: asBool(o.recording_present),
  };
}

async function fetchPage(opts: FetchCdrsOpts): Promise<{ rows: VerimorCdr[]; totalPages: number; total: number }> {
  const key = apiKey();
  const limit = Math.min(100, Math.max(10, opts.limit ?? 100));
  const page = Math.max(1, opts.page ?? 1);
  const url = new URL(`${apiBase()}/cdrs`);
  url.searchParams.set("key", key);
  url.searchParams.set("start_stamp_from", opts.from);
  url.searchParams.set("start_stamp_to", opts.to);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  if (opts.direction) url.searchParams.set("direction", opts.direction);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Verimor yanıt vermedi (zaman doldu)");
    throw new Error("Verimor’a bağlanılamadı");
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (res.status === 401) throw new Error("Verimor API anahtarı geçersiz");
  if (res.status === 429) throw new Error("Verimor istek limiti aşıldı");
  if (!res.ok) throw new Error(errorText(data, `Verimor hata ${res.status}`));

  const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const list = Array.isArray(obj.cdrs) ? obj.cdrs : Array.isArray(data) ? data : [];
  const pag = obj.pagination && typeof obj.pagination === "object" ? (obj.pagination as Record<string, unknown>) : {};
  const totalPages = Math.max(1, Number(pag.total_pages) || 1);
  const rows = list.map(mapCdr).filter((r): r is VerimorCdr => r !== null);
  const total =
    Number(pag.total) ||
    Number(pag.total_entries) ||
    Number(pag.total_count) ||
    Number(pag.count) ||
    (totalPages <= 1 ? rows.length : rows.length * totalPages);
  return { rows, totalPages, total };
}

export async function fetchCdrAdet(from: string, to: string): Promise<number> {
  const first = await fetchPage({ from, to, page: 1, limit: 10 });
  return first.total;
}

export async function fetchCdrs(opts: FetchCdrsOpts): Promise<VerimorCdr[]> {
  const first = await fetchPage({ ...opts, page: opts.page ?? 1, limit: opts.limit ?? 100 });
  if (opts.page) return first.rows;
  const out = [...first.rows];
  for (let p = 2; p <= first.totalPages && p <= 50; p++) {
    const next = await fetchPage({ ...opts, page: p, limit: opts.limit ?? 100 });
    out.push(...next.rows);
  }
  return out;
}

const TARIH_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function gunTarih(raw: string, fallback: string): string {
  return TARIH_RE.test(raw) ? raw : fallback;
}

/** Başlangıç–bitiş (en fazla 31 gün). Bitiş önceyse yer değişir. */
export function normalizeTarihAraligi(fromRaw: string, toRaw: string): { fromDate: string; toDate: string } {
  const bugun = istanbulBugun();
  let fromDate = gunTarih(fromRaw, bugun);
  let toDate = gunTarih(toRaw, fromDate);
  if (toDate < fromDate) {
    const t = fromDate;
    fromDate = toDate;
    toDate = t;
  }
  const start = new Date(`${fromDate}T00:00:00+03:00`);
  const maxEnd = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const maxTo = istanbulGun(maxEnd);
  if (toDate > maxTo) toDate = maxTo;
  return { fromDate, toDate };
}

export function istanbulAralikUtc(fromRaw: string, toRaw: string): { from: string; to: string } {
  const { fromDate, toDate } = normalizeTarihAraligi(fromRaw, toRaw);
  const start = new Date(`${fromDate}T00:00:00+03:00`);
  const end = new Date(`${toDate}T23:59:59+03:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Tarih geçersiz");
  return { from: toUtcStamp(start), to: toUtcStamp(end) };
}

export function istanbulGunAraligiUtc(date: string): { from: string; to: string } {
  return istanbulAralikUtc(date, date);
}

function toUtcStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
}

function istanbulGun(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function istanbulBugun(): string {
  return istanbulGun(new Date());
}

export function yonOzet(direction: string): "gelen" | "giden" | "dahili" | "diger" {
  const d = direction.toLowerCase();
  if (d.includes("inbound") || d.includes("gelen")) return "gelen";
  if (d.includes("outbound") || d.includes("giden")) return "giden";
  if (d.includes("internal") || d.includes("dahili")) return "dahili";
  return "diger";
}
