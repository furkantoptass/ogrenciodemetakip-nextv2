import { randomBytes, timingSafeEqual } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { turGecerli, type KodTur } from "./kod-tur";
import { SUPABASE_URL } from "./supabase/env";

const KUTU = "odt-api";
const DOSYA = "kodlar.json";
const ISIM_UZUN = 120;

export type ApiKod = {
  id: string;
  kod: string;
  tur: KodTur;
  isim: string;
  acik: boolean;
  olustu: string;
};

function istemci(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
  if (!SUPABASE_URL || !key) throw new Error("Kod kaydı açılamadı");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let kutuHazir = false;

async function kutuAc(db: SupabaseClient): Promise<void> {
  if (kutuHazir) return;
  const { data } = await db.storage.getBucket(KUTU);
  if (!data) {
    const created = await db.storage.createBucket(KUTU, { public: false });
    if (created.error && !/already exists/i.test(created.error.message)) {
      throw new Error(created.error.message);
    }
  }
  kutuHazir = true;
}

function kodMu(v: unknown): v is ApiKod {
  if (!v || typeof v !== "object") return false;
  const row = v as ApiKod;
  return (
    typeof row.id === "string" &&
    typeof row.kod === "string" &&
    typeof row.acik === "boolean" &&
    turGecerli(row.tur) &&
    typeof row.isim === "string" &&
    row.isim.trim().length > 0
  );
}

function yok(error: { message?: string; statusCode?: string | number } | null): boolean {
  if (!error) return false;
  const code = String(error.statusCode ?? "");
  return code === "404" || /not found/i.test(error.message ?? "");
}

async function oku(): Promise<ApiKod[]> {
  const db = istemci();
  await kutuAc(db);
  const { data, error } = await db.storage.from(KUTU).download(DOSYA);
  if (error) {
    if (yok(error)) return [];
    throw new Error(error.message);
  }
  const text = await data.text();
  if (!text.trim()) return [];
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(kodMu);
}

async function yaz(list: ApiKod[]): Promise<void> {
  const db = istemci();
  await kutuAc(db);
  const { error } = await db.storage.from(KUTU).upload(DOSYA, JSON.stringify(list), {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

let sira: Promise<unknown> = Promise.resolve();

function sirayla<T>(fn: () => Promise<T>): Promise<T> {
  const run = sira.then(fn, fn);
  sira = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function kodlarAyni(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function kodlariListele(): Promise<ApiKod[]> {
  const list = await oku();
  return list.sort((a, b) => (a.olustu < b.olustu ? 1 : -1));
}

export async function kodOlustur(gelen: { tur: string; isim: string }): Promise<ApiKod> {
  const tur = gelen.tur.trim();
  const isim = gelen.isim.trim().replace(/\s+/g, " ").slice(0, ISIM_UZUN);
  if (!turGecerli(tur)) throw new Error("Tür seç");
  if (!isim) throw new Error("İsim yaz");
  return sirayla(async () => {
    const list = await oku();
    let kod = "";
    for (let i = 0; i < 5; i += 1) {
      const aday = randomBytes(24).toString("base64url");
      if (!list.some((row) => row.kod === aday)) {
        kod = aday;
        break;
      }
    }
    if (!kod) throw new Error("Kod üretilemedi");
    const row: ApiKod = {
      id: randomBytes(8).toString("hex"),
      kod,
      tur,
      isim,
      acik: true,
      olustu: new Date().toISOString(),
    };
    list.push(row);
    await yaz(list);
    return row;
  });
}

export async function kodKapat(id: string): Promise<void> {
  const hedef = id.trim();
  if (!hedef) throw new Error("Kod seçilmedi");
  await sirayla(async () => {
    const list = await oku();
    const row = list.find((item) => item.id === hedef);
    if (!row) throw new Error("Kod bulunamadı");
    row.acik = false;
    await yaz(list);
  });
}

export async function kodAcikMi(gelen: string, tur: string): Promise<boolean> {
  const token = gelen.trim();
  if (!token || !turGecerli(tur)) return false;
  const list = await oku();
  return list.some((row) => row.acik && row.tur === tur && kodlarAyni(row.kod, token));
}
