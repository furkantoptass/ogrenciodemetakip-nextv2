import { createClient } from "@supabase/supabase-js";
import { rows } from "./db";
import { SUPABASE_URL } from "./supabase/env";

export type UcusPaylasim = { dakika: number; sorti: number };

export function saatYaz(dakika: number, ekran = false): string {
  const n = Math.max(0, Math.round(dakika));
  const h = Math.floor(n / 60);
  const m = n % 60;
  const saat = ekran ? h.toLocaleString("tr-TR") : String(h);
  return `${saat}:${String(m).padStart(2, "0")}`;
}

function sayi(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function dakika(row: { BlockTime?: unknown; flightDuration?: unknown; duration?: unknown }): number {
  return sayi(row.BlockTime) || sayi(row.flightDuration) || sayi(row.duration) || 0;
}

async function ucusTara(): Promise<UcusPaylasim> {
  const key = process.env.SUPABASE_SECRET_KEY ?? "";
  const db = createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const page = 1000;
  let from = 0;
  let toplam = 0;
  let sorti = 0;
  for (;;) {
    const { data, error } = await db
      .from("naeron_bi_flights")
      .select("BlockTime,flightDuration,duration,canceled,_lastRowStatus")
      .eq("realized", 1)
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const list = data ?? [];
    for (const row of list) {
      if (String(row._lastRowStatus ?? "").trim().toLowerCase() === "destroy") continue;
      const iptal = String(row.canceled ?? "").trim();
      if (iptal !== "" && iptal !== "0") continue;
      toplam += dakika(row);
      sorti += 1;
    }
    if (list.length < page) break;
    from += page;
  }
  return { dakika: toplam, sorti };
}

let onbellek: { at: number; deger: UcusPaylasim } | null = null;

export async function ucusPaylasim(): Promise<UcusPaylasim> {
  if (onbellek && Date.now() - onbellek.at < 60_000) return onbellek.deger;
  let deger: UcusPaylasim;
  try {
    const out = await rows<Partial<UcusPaylasim>>("odt_paylasim_ucus");
    deger = out[0]
      ? { dakika: Number(out[0].dakika) || 0, sorti: Number(out[0].sorti) || 0 }
      : await ucusTara();
  } catch {
    deger = await ucusTara();
  }
  onbellek = { at: Date.now(), deger };
  return deger;
}
