"use client";

import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type GostergeVeri = {
  id: string;
  label: string;
  ok: boolean;
  ozet: string | null;
  error: string | null;
  at?: string;
};

function zamanYaz(iso: string | undefined): string {
  if (!iso) return "henüz yok";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "henüz yok";
  const gun = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  const saat = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `${gun} ${saat}`;
}

export default function KaynakGosterge({
  veri,
  running,
}: {
  veri: GostergeVeri;
  running: boolean;
}) {
  const henuz = !veri.at && !running;
  const geldi = veri.ok && !running && !!veri.at;
  const hata = !running && !henuz && !geldi;
  const alt = running ? "bakıyor…" : henuz ? "bekleniyor" : geldi ? veri.ozet || "geldi" : veri.error || "gelmedi";
  return (
    <li
      className={cn("flex min-w-0 items-start gap-2.5 rounded-lg border bg-background p-2.5", hata && "border-destructive/30")}
      title={veri.error || veri.ozet || undefined}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {running ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : henuz ? (
          <Clock className="size-4 text-muted-foreground" />
        ) : geldi ? (
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircle className="size-4 text-destructive" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{veri.label}</span>
          {running ? (
            <Badge variant="outline">Bakılıyor</Badge>
          ) : henuz ? (
            <Badge variant="outline">Bekleniyor</Badge>
          ) : geldi ? (
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400">
              Geldi
            </Badge>
          ) : (
            <Badge variant="destructive">Gelmedi</Badge>
          )}
        </div>
        <p className={cn("mt-1 line-clamp-2 text-xs break-words", hata ? "text-destructive" : "text-muted-foreground")}>{alt}</p>
        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">Son bakış: {zamanYaz(veri.at)}</p>
      </div>
    </li>
  );
}
