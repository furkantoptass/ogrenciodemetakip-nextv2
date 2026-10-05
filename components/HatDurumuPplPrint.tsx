"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HatDurumuPplPrint() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="print:hidden"
      data-hat-ppl-print=""
      title="Tabloyu yazdırır; yazıcı olarak “PDF olarak kaydet” seçilebilir."
      onClick={() => window.print()}
    >
      <Printer aria-hidden />
      PDF indir
    </Button>
  );
}
