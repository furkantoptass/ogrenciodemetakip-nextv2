"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaylasimPanel({
  saat,
  sorti,
  adres,
  kilitVar,
}: {
  saat: string;
  sorti: number;
  adres: string;
  kilitVar: boolean;
}) {
  const [kopya, setKopya] = useState(false);

  async function kopyala() {
    try {
      await navigator.clipboard.writeText(adres);
      setKopya(true);
      toast.success("Adres kopyalandı");
      window.setTimeout(() => setKopya(false), 1500);
    } catch {
      toast.error("Kopyalanamadı");
    }
  }

  return (
    <PageShell>
      <PageHeader title="API" description="Dışarıya açılan bilgiler. Şimdilik yalnız uçuş." />
      <Card>
        <CardHeader>
          <CardTitle>Uçuş</CardTitle>
          <CardDescription>Tüm okul, baştan bugüne. İptal ve gerçekleşmemiş uçuşlar yok.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Toplam saat</p>
              <p className="text-2xl font-semibold tabular-nums">{saat}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sorti</p>
              <p className="text-2xl font-semibold tabular-nums">{sorti.toLocaleString("tr-TR")}</p>
            </div>
            <Badge variant="secondary" className="h-6 self-start">Açık</Badge>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">{adres}</code>
            <Button type="button" variant="outline" size="sm" onClick={() => void kopyala()}>
              {kopya ? <Check /> : <Copy />}
              Adresi kopyala
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {kilitVar
              ? "Karşı program bu adresi açarken anahtarı da gönderir. Anahtar gizli ayarda durur."
              : "Kapı kilitli değil. Anahtar tanımlanmadan dışarı sayı gitmez."}
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
