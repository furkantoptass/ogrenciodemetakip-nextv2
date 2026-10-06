import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import { getYetki } from "@/lib/odt-yetki";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "Northfly ODT", template: "%s · Northfly ODT" },
  description: "Öğrenci ödeme ve eğitim takip sistemi",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const yetki = email ? await getYetki(email) : null;
  // Çerçeve yalnızca aktif, yetkili oturumda gösterilir; giriş ve yetki-yok sayfaları yalın kalır.
  const shell = !!yetki?.active;

  return (
    <html lang="tr" className={cn("font-sans", geist.variable)}>
      <body className="antialiased">
        {shell ? (
          <TooltipProvider>
            <div className="flex min-h-svh flex-col">
              <AppHeader
                email={email}
                name={yetki.name || session?.user?.name || ""}
                canSearch={yetki.modules.includes("liste")}
                modules={yetki.modules}
              />
              <div className="min-w-0 flex-1">{children}</div>
            </div>
          </TooltipProvider>
        ) : (
          children
        )}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
