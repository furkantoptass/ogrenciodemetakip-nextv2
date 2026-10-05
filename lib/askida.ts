import { rows } from "./db";

export type AskidaTutar = { amount: number; symbol: string | null; shortcode: string | null };

export type AskidaOgrenci = {
  id: number;
  name: string;
  studentNo: string;
  gsm: string;
  /** "" (aktif) | "paused" | "graduated" */
  trainingStatus: string;
  graduated: boolean;
  training: string;
  phase: string;
  lastDuty: string;
  lastFlight: string | null;
  flights: number;
  minutes: number;
  canceled: number;
  fleet: string;
  label: string;
  labelColor: string | null;
  open: AskidaTutar[];
  overdue: AskidaTutar[];
  overdueSince: string | null;
  note: string;
  noteAuthor: string;
  noteDate: string | null;
  updated: string | null;
};

export type AskidaSayfa = { total: number; rows: AskidaOgrenci[] };

/** Naeron'da uçuşları askıya alınmış (suspendFlights) öğrenciler. `bugun`: YYYY-AA-GG. */
export async function getAskidaSayfa(bugun: string): Promise<AskidaSayfa> {
  const out = await rows<Partial<AskidaSayfa>>("odt_askida_sayfa", { p_today: bugun });
  return { total: out[0]?.total ?? 0, rows: out[0]?.rows ?? [] };
}
