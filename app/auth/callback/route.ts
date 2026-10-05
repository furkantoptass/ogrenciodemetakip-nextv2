import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canLogin } from "@/lib/odt-yetki";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=OAuth`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=OAuth`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  if (!email || !(await canLogin(email))) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=AccessDenied`);
  }

  // Yalnızca site içi yönlendirmeye izin ver.
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
