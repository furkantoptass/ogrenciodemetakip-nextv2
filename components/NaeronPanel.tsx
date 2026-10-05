"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, DatabaseZap, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type NaeronDurum = {
  table: string;
  label: string;
  lastRunAt: string | null;
  rowCount: number;
  ok: boolean | null;
  error: string | null;
};

type SyncResult = { table: string; ok: boolean; mode: string; fetched: number; written: number; deleted: number; error?: string };

function zaman(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(d);
}

export default function NaeronPanel({ durum, configured }: { durum: NaeronDurum[]; configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"changes" | "full" | null>(null);
  const [son, setSon] = useState<SyncResult[] | null>(null);

  async function calistir(full: boolean) {
    setBusy(full ? "full" : "changes");
    try {
      const res = await fetch(`/api/naeron/sync${full ? "?full=1" : ""}`, { method: "POST" });
      const data = (await res.json()) as { ok: boolean; results?: SyncResult[]; error?: string };
      setSon(data.results ?? null);
      if (data.ok) {
        const yazilan = (data.results ?? []).reduce((n, r) => n + r.written, 0);
        toast.success(`Eşitleme tamamlandı: ${yazilan.toLocaleString("tr-TR")} kayıt güncellendi.`);
      } else {
        const hatali = (data.results ?? []).filter((r) => !r.ok).map((r) => r.table);
        toast.error(data.error || `Eşitleme tamamlanamadı${hatali.length ? `: ${hatali.join(", ")}` : ""}.`);
      }
      router.refresh();
    } catch {
      toast.error("Eşitleme isteği gönderilemedi. Bağlantını kontrol edip tekrar dene.");
    } finally {
      setBusy(null);
    }
  }

  const sonByTable = new Map((son ?? []).map((r) => [r.table, r]));

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Naeron Eşitleme</h1>
          <p className="text-sm text-muted-foreground">
            Öğrenci, sözleşme, ödeme ve uçuş verisi Naeron REST BI servisinden çekilir.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => calistir(false)} disabled={!configured || busy !== null}>
            <RefreshCw className={busy === "changes" ? "animate-spin" : ""} aria-hidden="true" />
            {busy === "changes" ? "Çekiliyor…" : "Değişenleri çek"}
          </Button>
          <Button variant="outline" onClick={() => calistir(true)} disabled={!configured || busy !== null}>
            <DatabaseZap className={busy === "full" ? "animate-pulse" : ""} aria-hidden="true" />
            {busy === "full" ? "Tümü çekiliyor…" : "Tümünü baştan çek"}
          </Button>
        </div>
      </div>

      {!configured ? (
        <Card>
          <CardContent>
            <p className="text-sm text-destructive">
              NAERON_API_KEY tanımlı değil. Anahtarı ortam değişkenlerine ekleyip sunucuyu yeniden başlat.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Tablolar</CardTitle>
          <CardDescription>
            “Değişenleri çek” yalnızca son eşitlemeden beri güncellenen kayıtları alır; “Tümünü baştan çek” her tabloyu
            yeniden yükler.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tablo</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Son eşitleme</TableHead>
                <TableHead className="text-right">Son yazılan</TableHead>
                <TableHead className="text-right">Bu çalıştırma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {durum.map((d) => {
                const r = sonByTable.get(d.table);
                return (
                  <TableRow key={d.table}>
                    <TableCell className="font-medium">{d.label}</TableCell>
                    <TableCell>
                      {d.ok === null ? (
                        <Badge variant="outline">Hiç çekilmedi</Badge>
                      ) : d.ok ? (
                        <Badge variant="secondary">
                          <CheckCircle2 aria-hidden="true" />
                          Güncel
                        </Badge>
                      ) : (
                        <Badge variant="destructive" title={d.error ?? undefined}>
                          <XCircle aria-hidden="true" />
                          Hata
                        </Badge>
                      )}
                      {d.ok === false && d.error ? (
                        <span className="mt-1 block max-w-xs truncate text-xs text-muted-foreground">{d.error}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums">{zaman(d.lastRunAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.rowCount.toLocaleString("tr-TR")}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r ? `${r.written.toLocaleString("tr-TR")} kayıt${r.deleted ? ` · ${r.deleted} silindi` : ""}` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
