"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, MessagesSquare, Send, X } from "lucide-react";
import OdemeMesajlari from "@/components/OdemeMesajlari";
import { PageHeader, PageShell } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Channel = { id: number; name: string; phone: string; status: string; active: boolean };
type Template = {
  id: number;
  name: string;
  sendable: boolean;
  languageId: number | null;
  language: string;
  body: string;
  variables: string[];
};
type Chat = { id: number; phone: string; name: string; lastMessageAt: string | null };
type SendRow = {
  id: number;
  createdAt: string;
  authorEmail: string;
  phone: string;
  kind: string;
  body: string;
  templateName: string;
  ok: boolean;
  errorText: string;
};

const TABLE_WRAP =
  "max-h-[max(20rem,calc(100dvh-18rem))] min-w-0 overflow-auto rounded-xl bg-card ring-1 ring-foreground/10 [&_[data-slot=table-container]]:overflow-visible";
const TH_CLS = "h-9 bg-muted text-xs font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border)]";
const TEXTAREA_CLS =
  "min-h-28 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
const PICK_CLS =
  "rounded-lg border px-3 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";
const OK_BADGE = "border-emerald-500/50 text-emerald-700 dark:text-emerald-400";

function fmtPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  if (d.startsWith("90") && d.length === 12) return `0${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  return p || "—";
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) return `${m[3]}.${m[2]}. ${m[4]}:${m[5]}`;
  return iso;
}

function StatCard({
  label,
  hint,
  tone = "default",
  children,
}: {
  label: string;
  hint?: string;
  tone?: "default" | "destructive";
  children: ReactNode;
}) {
  return (
    <Card size="sm" className="gap-1">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={cn("text-lg leading-tight font-semibold tabular-nums", tone === "destructive" && "text-destructive")}>
          {children}
        </div>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </CardContent>
    </Card>
  );
}

export default function WapiPanel({ userEmail }: { userEmail: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [hatId, setHatId] = useState<number>(0);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [sends, setSends] = useState<SendRow[]>([]);
  const [loadErr, setLoadErr] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busyHat, setBusyHat] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [resultOk, setResultOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState("odeme");

  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState(0);
  const [params, setParams] = useState<Record<string, string>>({});

  const selected = channels.find((c) => c.id === hatId) ?? null;
  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;

  const loadHat = useCallback(async (id: number, opts?: { keepSendsIfEmpty?: boolean; keepTemplate?: boolean }) => {
    if (!id) return;
    setBusyHat(true);
    try {
      const res = await fetch(`/api/wapi/hat?id=${id}`);
      const data = await res.json();
      if (!data.ok) {
        setLoadErr(data.error || "Hat bilgisi alınamadı");
        return;
      }
      setTemplates(data.templates ?? []);
      setChats(data.chats ?? []);
      const incoming: SendRow[] = data.sends ?? [];
      setSends((prev) => (incoming.length > 0 ? incoming : opts?.keepSendsIfEmpty ? prev : incoming));
      if (!opts?.keepTemplate) {
        setTemplateId(0);
        setParams({});
      }
    } catch {
      setLoadErr("Hat bilgisi alınamadı");
    } finally {
      setBusyHat(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wapi/channels");
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) {
          setConnected(false);
          setLoadErr(data.error || "Bağlantı yok");
          return;
        }
        const list: Channel[] = data.channels ?? [];
        setChannels(list);
        setConnected(true);
        const prefer = Number(data.defaultId) || 0;
        const first = list.find((c) => c.id === prefer && c.active) ?? list.find((c) => c.active) ?? list[0];
        if (first) setHatId(first.id);
      } catch {
        if (!cancelled) {
          setConnected(false);
          setLoadErr("Bağlantı yok");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hatId) void loadHat(hatId);
  }, [hatId, loadHat]);

  const statusLabel = useMemo(() => {
    if (connected === null) return "Bakılıyor…";
    if (!connected) return "Bağlı değil";
    if (selected?.active) return `Bağlı · ${fmtPhone(selected.phone)}`;
    if (selected) return `Bağlı · hat bekliyor`;
    return "Bağlı";
  }, [connected, selected]);

  async function onSend() {
    setSending(true);
    setResult("");
    setResultOk(null);
    try {
      const payload: Record<string, unknown> = {
        integrationId: hatId,
        phone,
      };
      if (selectedTemplate) {
        payload.templateId = selectedTemplate.id;
        payload.languageId = selectedTemplate.languageId;
        payload.templateName = selectedTemplate.name;
        payload.parameters = params;
        payload.text = selectedTemplate.body;
      } else {
        payload.text = text;
      }
      const res = await fetch("/api/wapi/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setResultOk(true);
        setResult(`Gitti · ${data.phone}`);
        setSends((prev) => [
          {
            id: Date.now(),
            createdAt: new Date().toISOString(),
            authorEmail: userEmail,
            phone: String(data.phone),
            kind: selectedTemplate ? "sablon" : "yazi",
            body: selectedTemplate ? selectedTemplate.body : text,
            templateName: selectedTemplate?.name ?? "",
            ok: true,
            errorText: "",
          },
          ...prev,
        ]);
        await loadHat(hatId, { keepSendsIfEmpty: true, keepTemplate: true });
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

  function chatSec(c: Chat) {
    setPhone(c.phone.startsWith("+") ? c.phone : `+${c.phone}`);
    setTab("serbest");
  }

  const acikHat = channels.filter((c) => c.active).length;
  const gonderilebilir = templates.filter((t) => t.sendable).length;
  const hataliGonderim = sends.filter((s) => !s.ok).length;

  return (
    <PageShell>
      <PageHeader title="WhatsApp" description="Desk360 WAPI hattı üzerinden ödeme mesajları ve serbest mesaj gönderimi.">
        <Badge
          variant={connected === false ? "destructive" : "outline"}
          className={cn(connected && OK_BADGE)}
          role="status"
        >
          {connected ? <CircleCheck aria-hidden /> : connected === false ? <CircleAlert aria-hidden /> : null}
          {statusLabel}
        </Badge>
      </PageHeader>

      {loadErr && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{loadErr}</AlertTitle>
          <AlertDescription>WAPI bilgisi alınamadı. Sayfayı yenileyip tekrar dene; sürerse Desk360 bağlantı ayarlarını kontrol et.</AlertDescription>
        </Alert>
      )}

      <section aria-label="Özet göstergeler" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Hat" hint={`${acikHat} açık`}>{channels.length}</StatCard>
        <StatCard label="Şablon" hint={`${gonderilebilir} gönderilebilir`}>{templates.length}</StatCard>
        <StatCard
          label="Gönderim"
          hint={hataliGonderim > 0 ? `${hataliGonderim} hatalı` : "Bu ekrandan gidenler"}
          tone={hataliGonderim > 0 ? "destructive" : "default"}
        >
          {sends.length}
        </StatCard>
        <StatCard label="Sohbet" hint="Seçili hatta">{chats.length}</StatCard>
      </section>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Hatlar</CardTitle>
          <CardDescription>Mesajlar seçili hattan gider.</CardDescription>
        </CardHeader>
        <CardContent>
          {connected === null ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {connected ? "Tanımlı hat yok. Desk360’da bir WhatsApp hattı açınca burada görünür." : "Bağlantı kurulamadığı için hatlar okunamadı."}
            </p>
          ) : (
            <div role="group" aria-label="Hat seçimi" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={hatId === c.id}
                  onClick={() => setHatId(c.id)}
                  className={cn(PICK_CLS, hatId === c.id && "border-primary bg-muted")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{c.name}</span>
                    <Badge variant="outline" className={cn(c.active && OK_BADGE)}>
                      {c.active ? "Açık" : c.status || "Bekliyor"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">{fmtPhone(c.phone)}</div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="min-w-0 gap-3">
        <div className="max-w-full overflow-x-auto">
          <TabsList>
            <TabsTrigger value="odeme">Ödeme mesajları</TabsTrigger>
            <TabsTrigger value="serbest">Serbest mesaj</TabsTrigger>
            <TabsTrigger value="kayit">
              Gönderim kaydı
              <span className="text-xs text-muted-foreground tabular-nums">{sends.length}</span>
            </TabsTrigger>
            <TabsTrigger value="sohbet">
              Sohbetler
              <span className="text-xs text-muted-foreground tabular-nums">{chats.length}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="odeme" keepMounted className="max-w-3xl">
          <OdemeMesajlari
            hatId={hatId}
            connected={!!connected}
            templates={templates}
            onSent={() => void loadHat(hatId, { keepSendsIfEmpty: true, keepTemplate: true })}
          />
        </TabsContent>

        <TabsContent value="serbest" keepMounted>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Şablonlar</CardTitle>
                <CardDescription>
                  {busyHat ? "Şablonlar okunuyor…" : "Şablon seçersen değişkenlerini doldurursun; seçmezsen serbest yazarsın."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {templates.length === 0 ? (
                  busyHat ? (
                    <>
                      <Skeleton className="h-14" />
                      <Skeleton className="h-14" />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Bu hatta şablon yok. Desk360’da şablon onaylanınca burada görünür.</p>
                  )
                ) : (
                  <div role="group" aria-label="Şablon seçimi" className="flex max-h-112 flex-col gap-2 overflow-y-auto p-0.5">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        disabled={!t.sendable}
                        aria-pressed={templateId === t.id}
                        onClick={() => {
                          setTemplateId(t.id);
                          setParams({});
                          setResult("");
                          setResultOk(null);
                        }}
                        className={cn(PICK_CLS, templateId === t.id && "border-primary bg-muted")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-medium">{t.name}</span>
                          <Badge variant={t.sendable ? "secondary" : "outline"}>{t.sendable ? "Gönderilebilir" : "Kapalı"}</Badge>
                        </div>
                        {t.body && <div className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">{t.body}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Gönder</CardTitle>
                <CardDescription>
                  {selected ? `${selected.name} hattından gönderilir.` : "Önce bir hat seç."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wapi-numara">Numara</Label>
                  <Input
                    id="wapi-numara"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0533… veya +90…"
                    autoComplete="off"
                  />
                </div>

                {selectedTemplate ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Şablon</span>
                      <Badge variant="secondary">{selectedTemplate.name}</Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTemplateId(0);
                          setParams({});
                        }}
                      >
                        <X aria-hidden />
                        Şablonu bırak, serbest yaz
                      </Button>
                    </div>
                    {selectedTemplate.variables.map((v) => (
                      <div key={v} className="flex flex-col gap-1.5">
                        <Label htmlFor={`wapi-degisken-${v}`}>{v}</Label>
                        <Input
                          id={`wapi-degisken-${v}`}
                          value={params[v] ?? ""}
                          onChange={(e) => setParams((p) => ({ ...p, [v]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wapi-mesaj">Mesaj</Label>
                    <textarea
                      id="wapi-mesaj"
                      className={TEXTAREA_CLS}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Serbest mesaj"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={() => void onSend()} disabled={sending || !hatId || !connected}>
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
          </div>
        </TabsContent>

        <TabsContent value="kayit" keepMounted>
          <div className={TABLE_WRAP} role="region" aria-label="Bu ekrandan gönderilen mesajlar" tabIndex={0}>
            <Table>
              <TableHeader className="sticky top-0 z-10 [&_tr]:border-b-0">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className={TH_CLS}>Zaman</TableHead>
                  <TableHead scope="col" className={TH_CLS}>Numara</TableHead>
                  <TableHead scope="col" className={TH_CLS}>İçerik</TableHead>
                  <TableHead scope="col" className={TH_CLS}>Sonuç</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sends.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="align-top tabular-nums">{fmtWhen(s.createdAt)}</TableCell>
                    <TableCell className="align-top tabular-nums">{s.phone}</TableCell>
                    <TableCell className="max-w-xl min-w-56 align-top whitespace-normal">
                      {s.kind === "sablon" ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary">Şablon</Badge>
                          {s.templateName}
                        </span>
                      ) : (
                        <span className="line-clamp-3 break-words" title={s.body || undefined}>{s.body || "yazı"}</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs align-top whitespace-normal">
                      {s.ok ? (
                        <Badge variant="outline" className={OK_BADGE}>
                          <CircleCheck aria-hidden />
                          Gitti
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="destructive">
                            <CircleAlert aria-hidden />
                            Hata
                          </Badge>
                          {s.errorText ? <span className="mt-1 block text-xs break-words text-muted-foreground">{s.errorText}</span> : null}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {sends.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="py-10 text-center whitespace-normal text-muted-foreground">
                      <Send className="mx-auto mb-2 size-6" aria-hidden />
                      Bu ekrandan henüz mesaj gönderilmedi. Gönderdiğin mesajlar sonucu ile birlikte burada listelenir.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="sohbet" keepMounted>
          <div className={TABLE_WRAP} role="region" aria-label="Hattın sohbetleri" tabIndex={0}>
            <Table>
              <TableHeader className="sticky top-0 z-10 [&_tr]:border-b-0">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className={TH_CLS}>Numara</TableHead>
                  <TableHead scope="col" className={TH_CLS}>Ad</TableHead>
                  <TableHead scope="col" className={TH_CLS}>Son mesaj</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chats.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => chatSec(c)}>
                    <TableCell className="tabular-nums">
                      <button
                        type="button"
                        title="Bu numaraya serbest mesaj yaz"
                        className="rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {fmtPhone(c.phone)}
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-normal">{c.name || "—"}</TableCell>
                    <TableCell className="tabular-nums">{fmtWhen(c.lastMessageAt)}</TableCell>
                  </TableRow>
                ))}
                {chats.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="py-10 text-center whitespace-normal text-muted-foreground">
                      <MessagesSquare className="mx-auto mb-2 size-6" aria-hidden />
                      {busyHat ? "Sohbetler okunuyor…" : "Bu hatta sohbet yok. Bir satıra tıklayınca numara serbest mesaj formuna yazılır."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
