"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

const config = {
  saat: { label: "Uçuş saati", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function UcusGrafik({ data }: { data: Array<{ month: string; count: number; minutes: number }> }) {
  const rows = data.map((d) => {
    const [y, m] = d.month.split("-");
    return {
      ay: `${AYLAR[Number(m) - 1] ?? m} ${y.slice(2)}`,
      saat: Math.round((d.minutes / 60) * 10) / 10,
      ucus: d.count,
    };
  });

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Son 12 ayda gerçekleşen uçuş yok.</p>;
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={rows} margin={{ left: 0, right: 8, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="ay" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={36} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => (
                <span className="tabular-nums">
                  {Number(value).toLocaleString("tr-TR")} saat · {Number(item.payload?.ucus ?? 0).toLocaleString("tr-TR")} uçuş
                </span>
              )}
            />
          }
        />
        <Bar dataKey="saat" fill="var(--color-saat)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
