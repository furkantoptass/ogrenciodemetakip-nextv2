"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

const config = {
  gerceklesen: { label: "Gerçekleşen", color: "var(--chart-1)" },
  iptal: { label: "İptal", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function IptalGrafik({ data }: { data: Array<{ month: string; total: number; canceled: number }> }) {
  const rows = data.map((d) => {
    const [y, m] = d.month.split("-");
    return {
      ay: `${AYLAR[Number(m) - 1] ?? m} ${y.slice(2)}`,
      gerceklesen: d.total - d.canceled,
      iptal: d.canceled,
    };
  });

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Bu dönemde uçuş kaydı yok.</p>;
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={rows} margin={{ left: 0, right: 8, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="ay" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="gerceklesen" stackId="a" fill="var(--color-gerceklesen)" radius={[0, 0, 4, 4]} />
        <Bar dataKey="iptal" stackId="a" fill="var(--color-iptal)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
