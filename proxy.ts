import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { supabaseConfigured } from "@/lib/supabase/env";

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const yerel = process.env.NODE_ENV === "development" && (host === "127.0.0.1" || host === "localhost");
  const seoCekim = req.method === "POST" && path === "/api/seo/cek" && yerel;
  // The GET handler validates CRON_SECRET before running the scheduled job.
  const seoCron = req.method === "GET" && path === "/api/seo/cek";
  const naeronCron = req.method === "GET" && path === "/api/naeron/sync";
  const paylasim = req.method === "GET" && path === "/api/paylasim";
  const authRoute = path.startsWith("/auth/");

  if (seoCekim || seoCron || naeronCron || paylasim) return NextResponse.next();

  if (!supabaseConfigured()) {
    if (path === "/login" || authRoute) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  const { response, user } = await updateSession(req);
  if (authRoute) return response;
  const isLoggedIn = !!user;
  const isLoginPage = path === "/login";
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
