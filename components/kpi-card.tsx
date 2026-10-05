import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Sayfa üstündeki küçük özet kartı. */
export function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "danger";
}) {
  const danger = tone === "danger";
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        {Icon ? (
          <CardAction>
            <Icon className={cn("size-4", danger ? "text-destructive" : "text-muted-foreground")} aria-hidden="true" />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-semibold tabular-nums", danger && "text-destructive")}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

/** Tablo ve filtre alanlarında modüller arası ortak sınıflar. */
export const TABLE_WRAP_CLS =
  "max-h-[calc(100dvh-9rem)] min-w-0 overflow-auto rounded-xl bg-card ring-1 ring-foreground/10 [contain:inline-size] [&_[data-slot=table-container]]:overflow-visible";
export const TH_CLS =
  "h-auto bg-muted px-3 py-2 align-bottom text-[11px] leading-tight font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase shadow-[inset_0_-1px_0_var(--color-border)]";
/** Kendi kaydırma kabı olan uzun tablolar için sabit başlık. */
export const TH_STICKY_CLS = `sticky top-0 z-10 ${TH_CLS}`;
export const TD_CLS = "px-3 py-2 align-top";
export const NUM_CLS = "px-3 py-2 text-right align-top tabular-nums whitespace-nowrap";
export const SELECT_CLS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground";
export const CHECK_CLS = "size-4 shrink-0 rounded border-input accent-primary";
