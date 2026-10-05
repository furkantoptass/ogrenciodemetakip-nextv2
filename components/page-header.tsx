import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Modül sayfalarının ortak dış kabı: kenar boşlukları ve dikey aralık. */
export function PageShell({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex min-w-0 flex-col gap-4 p-4 md:p-6", className)}>{children}</div>;
}

/** Sayfa başlığı: solda başlık ve açıklama, sağda eylemler. */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
