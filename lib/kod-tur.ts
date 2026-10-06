export const KOD_TURLERI = [{ id: "ucus", ad: "Uçuş verileri" }] as const;

export type KodTur = (typeof KOD_TURLERI)[number]["id"];

export function turGecerli(id: string): id is KodTur {
  return KOD_TURLERI.some((tur) => tur.id === id);
}

export function turAd(id: string): string {
  return KOD_TURLERI.find((tur) => tur.id === id)?.ad ?? "";
}
