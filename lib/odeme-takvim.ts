import { rows } from "./db";
import { gunEkle } from "./format";

export type TakvimTaksit = {
  id: number;
  date: string;
  studentId: number;
  name: string;
  gsm: string;
  subject: string;
  installment: string;
  amount: number;
  symbol: string | null;
  shortcode: string | null;
  paid: boolean;
  note: string;
};

export type TaksitDurum = "paid" | "overdue" | "today" | "pending";

export function taksitDurum(t: { date: string; paid: boolean }, bugun: string): TaksitDurum {
  if (t.paid) return "paid";
  if (t.date < bugun) return "overdue";
  return t.date === bugun ? "today" : "pending";
}

/** Tarih aralığındaki (uçlar dahil) taksitler, vadeye göre sıralı. */
export async function getOdemeTakvim(from: string, to: string): Promise<TakvimTaksit[]> {
  return rows<TakvimTaksit>("odt_odeme_takvim", { p_from: from, p_to: to });
}

/** GET parametresinden geçerli bir ay (YYYY-AA) alır; değilse yedeği döndürür. */
export function ayParam(v: string | undefined, fallback: string): string {
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : fallback;
}

export function ayEkle(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** Ayı pazartesiden başlayan tam haftalara tamamlar; her hafta 7 gün (YYYY-AA-GG). */
export function ayHaftalari(ym: string): string[][] {
  const ilk = `${ym}-01`;
  const son = gunEkle(`${ayEkle(ym, 1)}-01`, -1);
  // getUTCDay: Pazar = 0; takvim pazartesiden başlar.
  let g = gunEkle(ilk, -((new Date(`${ilk}T00:00:00Z`).getUTCDay() + 6) % 7));
  const haftalar: string[][] = [];
  while (g <= son) {
    const hafta: string[] = [];
    for (let i = 0; i < 7; i++) {
      hafta.push(g);
      g = gunEkle(g, 1);
    }
    haftalar.push(hafta);
  }
  return haftalar;
}
