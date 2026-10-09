export const OKULLAR = [
  { id: "alfaair", ad: "AlfaAIR" },
  { id: "northfly", ad: "Northfly" },
] as const;

export type OkulId = (typeof OKULLAR)[number]["id"];

const HEPSI: OkulId[] = ["alfaair", "northfly"];

export function okulMu(v: unknown): v is OkulId {
  return v === "alfaair" || v === "northfly";
}

export function okulAd(id: string): string {
  return OKULLAR.find((o) => o.id === id)?.ad ?? "AlfaAIR";
}

/** Formdan gelen işaretler. Boş dizi, hiç okul seçilmedi demektir. */
export function secilenOkullar(raw: unknown): OkulId[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: OkulId[] = [];
  for (const x of arr) {
    if (okulMu(x) && !out.includes(x)) out.push(x);
  }
  return out;
}

/** Boş liste = iki okul da açık. Eski hesaplar böyle kalır. */
export function temizOkullar(raw: unknown): OkulId[] {
  const out = secilenOkullar(raw);
  return out.length ? out : [...HEPSI];
}

export function okulBaglanti(okul: OkulId): { base: string; key: string } {
  if (okul === "northfly") {
    return {
      base: (process.env.NAERON_API_BASE_NORTHFLY || "https://northfly.naeron.com:3110/v2").replace(/\/+$/, ""),
      key: (process.env.NAERON_API_KEY_NORTHFLY || "").trim(),
    };
  }
  return {
    base: (process.env.NAERON_API_BASE || "https://api.naeron.com:3110/v2").replace(/\/+$/, ""),
    key: (process.env.NAERON_API_KEY || "").trim(),
  };
}
