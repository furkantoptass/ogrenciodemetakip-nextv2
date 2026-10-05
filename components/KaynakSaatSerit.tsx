"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import KaynakGosterge, { type GostergeVeri } from "@/components/KaynakGosterge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const BOS: GostergeVeri[] = [
  { id: "naeron", label: "Naeron", ok: false, ozet: null, error: null },
  { id: "sozlesme", label: "Sözleşme", ok: false, ozet: null, error: null },
  { id: "ucus", label: "Uçuş", ok: false, ozet: null, error: null },
  { id: "formlar", label: "Formlar", ok: false, ozet: null, error: null },
  { id: "aramalar", label: "Arama", ok: false, ozet: null, error: null },
  { id: "wapi", label: "WAPI", ok: false, ozet: null, error: null },
  { id: "seo", label: "SEO", ok: false, ozet: null, error: null },
  { id: "google", label: "Google", ok: false, ozet: null, error: null },
  { id: "site", label: "Site", ok: false, ozet: null, error: null },
  { id: "kayit", label: "Kayıt", ok: false, ozet: null, error: null },
];

function eski(lastAt: string | null): boolean {
  if (!lastAt) return true;
  const t = new Date(lastAt).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t > 55 * 60 * 1000;
}

export default function KaynakSaatSerit() {
  const [rows, setRows] = useState<GostergeVeri[]>(BOS);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");

  const dene = useCallback(async () => {
    setRunning(true);
    setErr("");
    try {
      const res = await fetch("/api/super/kaynak", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error || "Deneme olmadı");
        return;
      }
      setRows(data.results ?? BOS);
    } catch {
      setErr("Deneme olmadı");
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const res = await fetch("/api/super/kaynak");
        const data = await res.json();
        if (stop) return;
        if (data.ok) {
          setRows(data.results ?? BOS);
          const sonuclar = (data.results ?? []) as GostergeVeri[];
          const ozetYok = sonuclar.some((r) => r.ok && !r.ozet) || sonuclar.every((r) => !r.at);
          if (eski(data.lastAt ?? null) || ozetYok) await dene();
        } else {
          setErr(data.error || "Okunamadı");
          await dene();
        }
      } catch {
        if (!stop) await dene();
      }
    })();
    const id = window.setInterval(() => {
      void dene();
    }, 60 * 60 * 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [dene]);

  const gelen = rows.filter((r) => r.ok && !!r.at).length;
  const gelmeyen = rows.filter((r) => !r.ok && !!r.at).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Kaynaklar</h2>
        </CardTitle>
        <CardDescription>Veri kaynaklarının son durumu. Her saat bakılır.</CardDescription>
        <CardAction className="flex flex-wrap items-center justify-end gap-2">
          {running ? null : gelmeyen > 0 ? (
            <Badge variant="destructive" className="tabular-nums">
              {gelmeyen} kaynak gelmedi
            </Badge>
          ) : gelen > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {gelen}/{rows.length} geldi
            </Badge>
          ) : null}
          <Button variant="outline" size="sm" disabled={running} onClick={() => void dene()}>
            <RefreshCw className={running ? "animate-spin" : ""} aria-hidden="true" />
            {running ? "Bakılıyor…" : "Şimdi bak"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5" aria-busy={running}>
          {rows.map((r) => (
            <KaynakGosterge key={r.id} veri={r} running={running} />
          ))}
        </ul>
        {err ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Kaynaklara bakılamadı: {err}</AlertTitle>
            <AlertDescription>“Şimdi bak” ile tekrar deneyin; sürerse bağlantınızı kontrol edin.</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
