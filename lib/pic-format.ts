export function picFmtMin(m: number): string {
  const n = Math.max(0, Math.round(Number(m) || 0));
  const h = Math.floor(n / 60);
  const mm = n % 60;
  return `${h}:${String(mm).padStart(2, "0")}`;
}
