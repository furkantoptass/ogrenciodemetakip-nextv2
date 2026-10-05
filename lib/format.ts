const SAYI = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

export function fmtSayi(n: number): string {
  return SAYI.format(n);
}

export function fmtPara(n: number, symbol: string | null | undefined): string {
  return `${SAYI.format(n)} ${symbol ?? ""}`.trim();
}

/** Para birimine göre toplamları "12.000 € + 5.000 ₺" biçiminde yazar. */
export function fmtToplam(rows: Array<{ amount: number; symbol: string | null; shortcode: string | null }>): string {
  const by = new Map<string, number>();
  for (const r of rows) {
    const key = r.symbol ?? r.shortcode ?? "";
    by.set(key, (by.get(key) ?? 0) + r.amount);
  }
  if (by.size === 0) return "—";
  return [...by.entries()].map(([sym, n]) => fmtPara(n, sym || null)).join(" + ");
}

/** Dakikayı saat:dakika olarak yazar (ör. 245:10). */
export function fmtSaat(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${SAYI.format(h)}:${String(m).padStart(2, "0")}`;
}

/** YYYY-AA-GG → GG.AA.YYYY */
export function fmtGun(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  return y && m && d ? `${d}.${m}.${y}` : ymd;
}

export function fmtYuzde(part: number, total: number): string {
  if (total <= 0) return "%0";
  return `%${Math.round((part / total) * 100)}`;
}

/** İstanbul saatine göre bugünün tarihi (YYYY-AA-GG). */
export function istanbulBugun(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export function gunEkle(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** İki tarih (YYYY-AA-GG) arasındaki gün sayısı; `to` daha ileriyse pozitif. */
export function gunFarki(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** GET parametresinden geçerli bir tarih (YYYY-AA-GG) alır; değilse yedeği döndürür. */
export function tarihParam(v: string | undefined, fallback: string): string {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : fallback;
}
