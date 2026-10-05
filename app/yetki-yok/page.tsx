import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LogOut, ShieldAlert, UserX } from "lucide-react";
import { auth } from "@/lib/auth";
import { firstOpenHref, getYetki } from "@/lib/odt-yetki";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yetki yok" };

export default async function YetkiYokPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const yetki = await getYetki(session.user.email);
  const yok = !yetki || !yetki.active;
  const acik = yok ? "/yetki-yok" : firstOpenHref(yetki);
  const Icon = yok ? UserX : ShieldAlert;
  return (
    // Hesabı olmayanlarda uygulama çerçevesi çizilmez; kart tüm ekranda ortalanır.
    <div className={cn("flex items-center justify-center p-4", yok ? "min-h-svh bg-muted/40" : "py-16 md:py-24")}>
      <Card className="w-full max-w-md gap-5 py-8 [--card-spacing:--spacing(6)]">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground" aria-hidden="true">
            <Icon className="size-6" />
          </span>
          <h1 className="text-lg font-semibold tracking-tight">
            {yok ? "Bu sistemde hesabın yok" : "Bu sayfa senin için açık değil"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {yok
              ? "Bu Google hesabı Northfly ODT’de kayıtlı değil ya da kapatılmış. Sayfaları görebilmen için superadmin’in hesabını eklemesi gerekir."
              : "Hesabın açık ama bu sayfa için yetkin yok. Soldaki menüden açık olan bir sayfaya geçebilirsin."}
          </p>
          <p className="text-xs break-all text-muted-foreground">
            Giriş yapılan hesap: <span className="font-medium text-foreground">{session.user.email}</span>
          </p>
        </CardContent>

        <CardContent>
          <h2 className="mb-2 text-sm font-medium">Ne yapabilirsin?</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
            {yok ? (
              <>
                <li>Superadmin’den bu e-posta için hesap açmasını iste, ardından yeniden giriş yap.</li>
                <li>Yanlış Google hesabıyla girdiysen çıkış yapıp doğru hesapla tekrar dene.</li>
              </>
            ) : (
              <>
                <li>Bu sayfaya ihtiyacın varsa superadmin’den Yetkiler ekranında sayfayı açmasını iste.</li>
                <li>Farklı bir hesapla girmen gerekiyorsa çıkış yapıp tekrar dene.</li>
              </>
            )}
          </ul>
        </CardContent>

        <CardFooter className="flex-wrap justify-end gap-2">
          <a href="/auth/signout" className={buttonVariants({ variant: acik === "/yetki-yok" ? "default" : "outline" })}>
            <LogOut aria-hidden="true" />
            Çıkış yap
          </a>
          {acik !== "/yetki-yok" ? (
            <Link href={acik} className={buttonVariants()}>
              Açık sayfama git
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}
