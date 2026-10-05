"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Search, Send, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ODEME_ALAN_ETIKET,
  ODEME_MESAJLARI,
  desk360Parametreler,
  findDesk360Sablon,
  fmtGun,
  onizlemeDoldur,
  todayYmd,
  type OdemeAlan,
} from "@/lib/odeme-mesaj-tanim";

type Template = {
  id: number;
  name: string;
  sendable: boolean;
  languageId: number | null;
  body: string;
  variables: string[];
};

type Hit = { kind: string; id: number; name: string; extra: string; href: string | null };
type Doldur = {
  id: number;
  name: string;
  phone: string;
  phoneOk: boolean;
  not: string;
  values: Record<string, Record<OdemeAlan, string>>;
  uygun: Record<string, boolean>;
};

const EMPTY: Record<OdemeAlan, string> = {
  ad_soyad: "",
  vade_tarihi: "",
  odeme_tutari: "",
  gecikmis_tutar: "",
  son_odeme_tarihi: "",
  yeni_odeme_plani: "",
};

function doldurAlan(raw: Record<OdemeAlan, string> | undefined, fields: OdemeAlan[]): Record<OdemeAlan, string> {
  const out: Record<OdemeAlan, string> = { ...EMPTY, ...(raw ?? {}) };
  const bugun = fmtGun(todayYmd());
  if (fields.includes("vade_tarihi") && !out.vade_tarihi.trim()) out.vade_tarihi = bugun;
  if (fields.includes("son_odeme_tarihi") && !out.son_odeme_tarihi.trim()) out.son_odeme_tarihi = bugun;
  return out;
}

export default function OdemeMesajlari({
  hatId,
  connected,
  templates,
  onSent,
}: {
  hatId: number;
  connected: boolean;
  templates: Template[];
  onSent: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [ogrenci, setOgrenci] = useState<Doldur | null>(null);
  const [mesajId, setMesajId] = useState(ODEME_MESAJLARI[0].id);
  const [alan, setAlan] = useState<Record<OdemeAlan, string>>(EMPTY);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [resultOk, setResultOk] = useState<boolean | null>(null);
  const [autoOn, setAutoOn] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoNot, setAutoNot] = useState("");

  const tanim = ODEME_MESAJLARI.find((m) => m.id === mesajId) ?? ODEME_MESAJLARI[0];
  const tpl = findDesk360Sablon(templates, tanim);

  useEffect(() => {
    void fetch("/api/wapi/otomatik")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAutoOn(!!d.enabled);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (ogrenci) {
      setHits([]);
      return;
    }
    const t = q.trim();
    if (t.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/arama?q=${encodeURIComponent(t)}`, { signal: ctrl.signal });
        const data = await res.json();
        const list: Hit[] = (data.results ?? []).filter((h: Hit) => h.kind === "ogrenci");
        setHits(list);
      } catch {
        if (!ctrl.signal.aborted) setHits([]);
      }
    }, 200);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, ogrenci]);

  async function secOgrenci(id: number) {
    setBusy(true);
    setHits([]);
    setResult("");
    try {
      const res = await fetch(`/api/wapi/odeme?id=${id}`);
      const data = await res.json();
      if (!data.ok) {
        setOgrenci(null);
        setResult(data.error || "Öğrenci okunamadı");
        setResultOk(false);
        return;
      }
      const o = data.ogrenci as Doldur;
      setOgrenci(o);
      setQ(o.name);
      setPhone(o.phone);
      const fields = (ODEME_MESAJLARI.find((m) => m.id === mesajId) ?? ODEME_MESAJLARI[0]).fields;
      setAlan(doldurAlan(o.values[mesajId], fields));
    } finally {
      setBusy(false);
    }
  }

  function secMesaj(id: string) {
    setMesajId(id);
    setResult("");
    if (ogrenci) {
      const fields = (ODEME_MESAJLARI.find((m) => m.id === id) ?? ODEME_MESAJLARI[0]).fields;
      setAlan(doldurAlan(ogrenci.values[id], fields));
    }
  }

  const values = tanim.fields.map((f) => alan[f] ?? "");
  const preview = useMemo(() => onizlemeDoldur(tanim.body, values), [tanim, values]);
  const eksik = tanim.fields.some((f) => !(alan[f] ?? "").trim());

  async function gonder() {
    const cep = phone.trim();
    if (!cep) {
      setResultOk(false);
      setResult("Cep yok");
      return;
    }
    if (!tpl?.sendable || !tpl.languageId) {
      setResultOk(false);
      setResult("Bu şablon Desk360’da yok veya henüz onaylı değil");
      return;
    }
    setSending(true);
    setResult("");
    try {
      const res = await fetch("/api/wapi/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId: hatId,
          phone: cep,
          templateId: tpl.id,
          languageId: tpl.languageId,
          templateName: tpl.name,
          parameters: desk360Parametreler(tpl.variables, values),
          text: preview,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResultOk(true);
        setResult(`Gitti · ${ogrenci?.name || cep}`);
        onSent();
      } else {
        setResultOk(false);
        setResult(data.error || "Gönderilemedi");
      }
    } catch {
      setResultOk(false);
      setResult("Gönderilemedi");
    } finally {
      setSending(false);
    }
  }

  async function autoAcKapa(on: boolean) {
    setAutoBusy(true);
    try {
      const res = await fetch("/api/wapi/otomatik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: on }),
      });
      const data = await res.json();
      if (data.ok) {
        setAutoOn(on);
        setAutoNot(on ? "Otomatik açık. 1 ve 2 kurala göre gider." : "Manuel: sen seçip gönderirsin.");
      } else setAutoNot(data.error || "Kaydedilemedi");
    } finally {
      setAutoBusy(false);
    }
  }

  async function autoCalistir() {
    setAutoBusy(true);
    setAutoNot("");
    try {
      const res = await fetch("/api/wapi/otomatik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run: true, integrationId: hatId }),
      });
      const data = await res.json();
      if (data.ok) {
        setAutoNot(`Gitti: ${data.gitti} · Atlandı: ${data.atlandi}${data.hatalar?.length ? ` · ${data.hatalar[0]}` : ""}`);
        onSent();
      } else setAutoNot(data.error || "Çalışmadı");
    } finally {
      setAutoBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Ödeme mesajları</CardTitle>
        <CardDescription>{autoOn ? "Otomatik gönderim açık" : "Manuel gönderim"}</CardDescription>
        <CardAction className="flex flex-wrap items-center justify-end gap-1.5">
          <div role="group" aria-label="Gönderim modu" className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={!autoOn ? "default" : "outline"}
              aria-pressed={!autoOn}
              disabled={autoBusy}
              onClick={() => void autoAcKapa(false)}
            >
              Manuel
            </Button>
            <Button
              type="button"
              size="sm"
              variant={autoOn ? "default" : "outline"}
              aria-pressed={autoOn}
              disabled={autoBusy}
              onClick={() => void autoAcKapa(true)}
            >
              Otomatik
            </Button>
          </div>
          {autoOn && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={autoBusy || !hatId || !connected}
              onClick={() => void autoCalistir()}
            >
              <Play aria-hidden />
              Bugün gönder
            </Button>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {autoNot && <p className="m-0 text-xs text-muted-foreground" role="status">{autoNot}</p>}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="odm-ogrenci">Öğrenci</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="odm-ogrenci"
              className="pl-8"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOgrenci(null);
                setPhone("");
              }}
              placeholder="Ad, soyad, kısa kod…"
              autoComplete="off"
            />
          </div>
          {hits.length > 0 && (
            <ul aria-label="Öğrenci sonuçları" className="max-h-40 divide-y overflow-y-auto rounded-lg border">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
                    onClick={() => void secOgrenci(h.id)}
                  >
                    {h.name} {h.extra ? <span className="text-muted-foreground">{h.extra}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {busy && <p className="m-0 text-sm text-muted-foreground" role="status">Okunuyor…</p>}
        </div>

        {ogrenci && (
          <>
            <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{ogrenci.name}</span>
              {ogrenci.not ? <Badge variant="outline" className="h-auto whitespace-normal">{ogrenci.not}</Badge> : null}
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="odm-cep">Cep</Label>
              <Input
                id="odm-cep"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xx…"
              />
            </div>
          </>
        )}

        <div role="group" aria-label="Mesaj türü" className="flex flex-col gap-1.5">
          {ODEME_MESAJLARI.map((m) => {
            const on = mesajId === m.id;
            const uygun = ogrenci ? ogrenci.uygun[m.id] : false;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() => secMesaj(m.id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  on && "border-primary bg-muted"
                )}
              >
                <div className="text-sm font-medium">{m.title}</div>
                <div className="text-xs text-muted-foreground">
                  {m.when}
                  {ogrenci && !uygun && m.id !== "plan_onay" ? " · bu öğrenci için kural yok" : ""}
                </div>
              </button>
            );
          })}
        </div>

        {templates.length > 0 && !tpl?.sendable && (
          <Alert>
            <TriangleAlert aria-hidden />
            <AlertDescription>Desk360’da {tanim.templateName} yok veya onaylı değil. Önce orada aç.</AlertDescription>
          </Alert>
        )}

        {tanim.fields.map((f) => (
          <div key={f} className="flex flex-col gap-1.5">
            <Label htmlFor={`odm-alan-${f}`}>{ODEME_ALAN_ETIKET[f]}</Label>
            {f === "yeni_odeme_plani" ? (
              <textarea
                id={`odm-alan-${f}`}
                className="min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={alan[f]}
                onChange={(e) => setAlan((p) => ({ ...p, [f]: e.target.value }))}
                placeholder="15.10.2026: 2.500€; 15.11.2026: 2.500€"
              />
            ) : (
              <Input
                id={`odm-alan-${f}`}
                value={alan[f]}
                onChange={(e) => setAlan((p) => ({ ...p, [f]: e.target.value }))}
              />
            )}
          </div>
        ))}

        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-medium text-muted-foreground">Önizleme</div>
          <pre className="m-0 rounded-lg border bg-muted/50 p-3 font-sans text-sm whitespace-pre-wrap">{preview}</pre>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void gonder()}
            disabled={sending || !hatId || !connected || !ogrenci || eksik || !phone.trim()}
          >
            <Send aria-hidden />
            {sending ? "Gönderiliyor…" : "Gönder"}
          </Button>
          {result && (
            <p className={cn("m-0 text-sm font-medium", resultOk ? "text-foreground" : "text-destructive")} role="status">
              {result}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
