"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, PlaneTakeoff, ShieldCheck, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

function LoginInner({ configured, allowedDomains }: { configured: boolean; allowedDomains: string }) {
  const sp = useSearchParams();
  const denied = sp.get("error") === "AccessDenied";
  const oauthError = sp.get("error") === "OAuth";
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState(false);

  async function googleIleGir() {
    setBusy(true);
    setStartError(false);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStartError(true);
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <Card className="w-full max-w-sm gap-6 py-8 [--card-spacing:--spacing(6)]">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden="true">
            <PlaneTakeoff className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Northfly ODT</h1>
            <p className="mt-1 text-sm text-muted-foreground">Öğrenci takip sistemi</p>
          </div>
        </CardContent>

        <CardContent className="flex flex-col gap-3">
          {!configured ? (
            <Alert role="status" className="border-amber-500/50 text-amber-800 dark:text-amber-300">
              <Wrench aria-hidden="true" />
              <AlertDescription className="text-current">
                İlk kurulum devam ediyor. Hesap girişi henüz etkinleştirilmedi.
              </AlertDescription>
            </Alert>
          ) : null}
          {denied ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Bu sistemde hesabın yok. Superadmin eklesin.</AlertTitle>
            </Alert>
          ) : null}
          {oauthError || startError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Google ile giriş tamamlanamadı. Tekrar dene.</AlertTitle>
            </Alert>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={!configured || busy}
            onClick={googleIleGir}
            className="h-10 w-full gap-3"
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {busy ? "Google’a yönlendiriliyor…" : "Google ile giriş yap"}
          </Button>
        </CardContent>

        <CardFooter className="items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 break-words">Yalnızca izinli hesaplar: {allowedDomains}</p>
        </CardFooter>
      </Card>
      <p className="text-xs text-muted-foreground">Öğrenci ödeme ve eğitim takip sistemi</p>
    </main>
  );
}

export default function LoginForm({ configured, allowedDomains }: { configured: boolean; allowedDomains: string }) {
  return (
    <Suspense>
      <LoginInner configured={configured} allowedDomains={allowedDomains} />
    </Suspense>
  );
}
