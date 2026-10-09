import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/lib/auth";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { type OkulId, okulMu, temizOkullar } from "@/lib/okul";

const HEPSI: OkulId[] = ["alfaair", "northfly"];

async function kayitliOkullar(email: string): Promise<OkulId[]> {
  const key = process.env.SUPABASE_SECRET_KEY ?? "";
  if (!SUPABASE_URL || !key) return [...HEPSI];
  const client = createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const user = await client.rpc("odt_yetki_user_by_email", { p_email: email });
  const row = Array.isArray(user.data) ? (user.data[0] as { id?: unknown } | undefined) : undefined;
  const id = Number(row?.id);
  if (!id) return [...HEPSI];
  const okul = await client.rpc("odt_yetki_okullar", { p_user_id: id });
  if (okul.error) return [...HEPSI];
  return temizOkullar(okul.data);
}

/** Seçili okul. Çerezdeki okul, kişinin açabileceği okullardan biri değilse AlfaAIR'a döner. */
export const aktifOkul = cache(async (): Promise<OkulId> => {
  let cookie = "";
  try {
    cookie = (await cookies()).get("odt_okul")?.value ?? "";
  } catch {
    cookie = "";
  }
  let izin = [...HEPSI];
  try {
    const session = await auth();
    const email = session?.user?.email ?? "";
    if (email) izin = await kayitliOkullar(email);
  } catch {
    izin = [...HEPSI];
  }
  if (okulMu(cookie) && izin.includes(cookie)) return cookie;
  if (izin.includes("alfaair")) return "alfaair";
  return izin[0] ?? "alfaair";
});
