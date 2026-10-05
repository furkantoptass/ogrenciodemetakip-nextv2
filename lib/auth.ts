import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

export type Session = { user: { email: string; name: string } };

/**
 * Supabase Auth oturumunu (Google ile giriş) döndürür; oturum yoksa null.
 * getUser() token'ı Supabase Auth sunucusunda doğrular.
 */
export async function auth(): Promise<Session | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email) return null;
  const meta = user.user_metadata ?? {};
  return { user: { email, name: String(meta.full_name ?? meta.name ?? "") } };
}
