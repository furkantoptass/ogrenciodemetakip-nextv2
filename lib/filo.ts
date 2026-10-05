import { rows } from "./db";

export type FiloArac = {
  id: number;
  reg: string;
  model: string;
  /** "aircraft" | "simulator" */
  kind: string;
  external: boolean;
  outOfInventory: boolean;
  underMaintenance: boolean;
  engine: string;
  tacho: number | null;
  color: string | null;
  lastBase: string;
  lastFlight: string | null;
  /** UEGGS (uçuşa elverişlilik gözden geçirme sertifikası) geçerlilik tarihi. */
  arc: string | null;
  flights: number;
  minutes: number;
  flights30: number;
  minutes30: number;
  canceled30: number;
};

export type FiloDurum = "hazir" | "bakim" | "sure-doldu" | "belgesiz" | "envanter-disi";

export function filoDurum(a: FiloArac, bugun: string): FiloDurum {
  if (a.outOfInventory) return "envanter-disi";
  if (a.underMaintenance) return "bakim";
  if (!a.arc) return "belgesiz";
  return a.arc < bugun ? "sure-doldu" : "hazir";
}

/** Naeron uçak ve simülatör listesi + uçuş kayıtlarından kullanım özeti. `bugun`: YYYY-AA-GG. */
export async function getFiloSayfa(bugun: string): Promise<FiloArac[]> {
  return rows<FiloArac>("odt_filo_sayfa", { p_today: bugun });
}
