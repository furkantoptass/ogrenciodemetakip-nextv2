export function toWhatsAppPhone(raw: string): string | null {
  let s = raw.trim().replace(/[\s\-()]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (s.startsWith("0") && !s.startsWith("00")) s = `+90${s.slice(1)}`;
  if (/^90\d{10}$/.test(s)) s = `+${s}`;
  if (/^5\d{9}$/.test(s)) s = `+90${s}`;
  if (!s.startsWith("+")) s = `+${s}`;
  if (!/^\+\d{8,15}$/.test(s)) return null;
  return s;
}
