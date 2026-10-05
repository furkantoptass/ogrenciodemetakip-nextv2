import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./supabase/env";

/**
 * Veritabanı erişimi yalnızca Supabase API'si üzerinden yapılır: her sorgu
 * `supabase/migrations` altındaki sabit bir Postgres fonksiyonudur (odt_*).
 * Fonksiyonları yalnızca service_role çağırabilir; gizli anahtar sadece sunucuda durur.
 */
const globalForDb = globalThis as unknown as { odtAdmin?: SupabaseClient };

function admin(): SupabaseClient {
  if (globalForDb.odtAdmin) return globalForDb.odtAdmin;
  const key = process.env.SUPABASE_SECRET_KEY ?? "";
  if (!SUPABASE_URL || !key) {
    throw new Error("Supabase yapılandırılmadı: NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SECRET_KEY gerekli.");
  }
  const client = createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (process.env.NODE_ENV !== "production") globalForDb.odtAdmin = client;
  return client;
}

// to_jsonb(timestamp) saat dilimi olmadan ISO metni üretir; eski sürücü gibi UTC Date'e çevrilir.
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

function revive(v: unknown): unknown {
  if (typeof v === "string") return TS_RE.test(v) ? new Date(`${v}Z`) : v;
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) o[k] = revive(o[k]);
    return o;
  }
  return v;
}

async function call(fn: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await admin().rpc(fn, args ?? {});
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}

/** Satır döndüren fonksiyon (jsonb dizi döner). Zaman damgaları Date olur. */
export async function rows<T = Record<string, unknown>>(fn: string, args?: Record<string, unknown>): Promise<T[]> {
  const data = await call(fn, args);
  return (Array.isArray(data) ? (revive(data) as T[]) : []);
}

/** INSERT/UPDATE/DELETE fonksiyonu: etkilenen satır sayısını döndürür. */
export async function run(fn: string, args?: Record<string, unknown>): Promise<number> {
  const data = await call(fn, args);
  return typeof data === "number" ? data : 0;
}
