"use client";

import { useState } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ApiKod } from "@/lib/api-kod";
import { KOD_TURLERI, turAd } from "@/lib/kod-tur";

export default function PaylasimPanel({
  saat,
  sorti,
  adres,
  kodlar,
  kodHata,
}: {
  saat: string;
  sorti: number;
  adres: string;
  kodlar: ApiKod[];
  kodHata: string;
}) {
  const [liste, setListe] = useState(kodlar);
  const [adresKopya, setAdresKopya] = useState(false);
  const [kopyaId, setKopyaId] = useState("");
  const [islem, setIslem] = useState("");
  const [formAcik, setFormAcik] = useState(false);
  const [tur, setTur] = useState("");
  const [isim, setIsim] = useState("");

  async function kopyala(yazi: string, id: string) {
    try {
      await navigator.clipboard.writeText(yazi);
      if (id === "adres") {
        setAdresKopya(true);
        window.setTimeout(() => setAdresKopya(false), 1500);
      } else {
        setKopyaId(id);
        window.setTimeout(() => setKopyaId(""), 1500);
      }
      toast.success(id === "adres" ? "Adres kopyalandı" : "Kod kopyalandı");
    } catch {
      toast.error("Kopyalanamadı");
    }
  }

  async function gonder(action: "yeni" | "kapat", id = "") {
    if (action === "yeni" && (!tur || !isim.trim())) {
      toast.error(!tur ? "Tür seç" : "İsim yaz");
      return;
    }
    setIslem(id || action);
    try {
      const res = await fetch("/api/paylasim/kod", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, id, tur, isim }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; kodlar?: ApiKod[] };
      if (!res.ok || !data.ok || !data.kodlar) {
        toast.error(data.error || "Kaydedilemedi");
        return;
      }
      setListe(data.kodlar);
      if (action === "yeni") {
        setTur("");
        setIsim("");
        setFormAcik(false);
      }
      toast.success(action === "yeni" ? "Yeni kod hazır" : "Kod kapatıldı");
    } catch {
      toast.error("Kaydedilemedi");
    } finally {
      setIslem("");
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
            <Badge variant="secondary" className="h-6 self-start">
              Açık
            </Badge>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">{adres}</code>
            <Button type="button" variant="outline" size="sm" onClick={() => void kopyala(adres, "adres")}>
              {adresKopya ? <Check /> : <Copy />}
              Adresi kopyala
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Karşı program bu adresi açarken bir açık kod gönderir. Öğrenci adı çıkmaz.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kodlar</CardTitle>
          <CardDescription>Tür ve isim zorunlu. Kapatılan kod bir daha açmaz.</CardDescription>
          <CardAction>
            <Button type="button" size="sm" disabled={islem !== ""} onClick={() => setFormAcik((acik) => !acik)}>
              <Plus />
              Yeni kod
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {formAcik ? (
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Tür
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
                  value={tur}
                  onChange={(e) => setTur(e.target.value)}
                >
                  <option value="">Tür seç</option>
                  {KOD_TURLERI.map((secenek) => (
                    <option key={secenek.id} value={secenek.id}>
                      {secenek.ad}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                İsim
                <Input
                  value={isim}
                  maxLength={120}
                  placeholder="northfly.aero display ekran bağlantısı için"
                  onChange={(e) => setIsim(e.target.value)}
                />
              </label>
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={islem !== "" || !tur || !isim.trim()} onClick={() => void gonder("yeni")}>
                  Oluştur
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setFormAcik(false)}>
                  Vazgeç
                </Button>
              </div>
            </div>
          ) : null}
          {kodHata ? <p className="text-sm text-destructive">{kodHata}</p> : null}
          {liste.length === 0 && !kodHata ? (
            <p className="text-sm text-muted-foreground">Henüz kod yok. Yeni kod’a bas.</p>
          ) : null}
          {liste.map((row) => (
            <div key={row.id} className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${row.acik ? "" : "text-muted-foreground"}`}>{row.isim}</p>
                <p className="text-xs text-muted-foreground">{turAd(row.tur)}</p>
                <code className={`mt-1 block break-all text-xs ${row.acik ? "" : "text-muted-foreground line-through"}`}>
                  {row.kod}
                </code>
              </div>
              <Badge variant={row.acik ? "secondary" : "outline"} className="h-6 w-fit">
                {row.acik ? "Açık" : "Kapalı"}
              </Badge>
              {row.acik ? (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void kopyala(row.kod, row.id)}>
                    {kopyaId === row.id ? <Check /> : <Copy />}
                    Kopyala
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={islem !== ""}
                    onClick={() => void gonder("kapat", row.id)}
                  >
                    Kapat
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
