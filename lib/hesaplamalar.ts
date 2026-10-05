export const ODT_DEFAULT_CORP_LABEL_IDS = [663, 1079, 1082, 1085, 875, 1077, 1080, 1083, 779, 1078, 1081, 1084, 1090];
export const ODT_PLAN_EUR_THRESHOLD = 50000.0;
/** PHP extra-flight-billing.json — ücretli extra uçuş × EUR/saat */
export const ODT_EXTRA_BILL_EUR_PER_HOUR = 500;

export function isContractNotCancelled(contractStatus: string | null): boolean {
  if (!contractStatus) return true;
  return contractStatus.trim().toLowerCase() !== "cancelcontract";
}

export function isTrainingNotCancelled(trainingStatus: string | null): boolean {
  if (!trainingStatus) return true;
  return trainingStatus.trim().toLowerCase() !== "cancelcontract";
}

export function isInstallmentRowActive(lastRowStatus: string | null): boolean {
  const s = (lastRowStatus ?? "").trim().toLowerCase();
  return s === "create" || s === "update";
}

export function isStudentListable(lastRowStatus: string | null, trainingStatus: string | null): boolean {
  return isInstallmentRowActive(lastRowStatus) && isTrainingNotCancelled(trainingStatus);
}

export function contractSubjectIsExtra(subject: string): boolean {
  const l = subject.trim().toLowerCase();
  return l.includes("extra") || l.includes("ekstra");
}

export function fmtMinutes(m: number): string {
  if (m <= 0) return "—";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, "0")}`;
}

export function fmtMoneyEu(n: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(n);
}

export function fmtMoneyDec(n: number): string {
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** PHP odt_extra_billed_eur_cell: extra dakika / 60 × EUR/saat */
export function extraBilledEur(extraFlightMinutes: number, eurPerHour = ODT_EXTRA_BILL_EUR_PER_HOUR): number | null {
  if (eurPerHour <= 0 || extraFlightMinutes <= 0) return null;
  return (extraFlightMinutes / 60) * eurPerHour;
}

export function currencyIsEur(currencyId: number, currencyIsEurMap: Record<number, boolean>): boolean {
  return !!currencyIsEurMap[currencyId];
}

export function autoplanFromContractEur(
  moneyRows: Array<{ currencyID?: number; sum_price?: number }>,
  currencyIsEurMap: Record<number, boolean>
): number {
  let eur = 0;
  for (const r of moneyRows) {
    const cid = r.currencyID ?? 0;
    if (cid > 0 && currencyIsEur(cid, currencyIsEurMap)) {
      eur += r.sum_price ?? 0;
    }
  }
  return eur >= ODT_PLAN_EUR_THRESHOLD ? 1 : 0;
}

export type RatingBitId = "cpl" | "ir" | "me" | "atpl";

export function ratingBitColumns(id: RatingBitId) {
  switch (id) {
    case "cpl": return { planCol: "cpl_plan_manual", flownCol: "cpl_manual", schoolCol: "cpl_flown_school", label: "CPL" };
    case "ir": return { planCol: "ir_plan_manual", flownCol: "ir_manual", schoolCol: "ir_flown_school", label: "IR" };
    case "me": return { planCol: "me_plan_manual", flownCol: "me_manual", schoolCol: "me_flown_school", label: "ME" };
    default: return { planCol: "atpl_plan_manual", flownCol: "atpl_theory_manual", schoolCol: "atpl_flown_school", label: "ATPL theory" };
  }
}

export function ratingBitState(
  id: RatingBitId,
  manualRow: Record<string, unknown>,
  autoPlan: number
): { auto_plan: number; plan: number; plan_manual: number | null; flown: number; school: string } {
  const cols = ratingBitColumns(id);
  const planManRaw = manualRow[cols.planCol];
  const flownRaw = manualRow[cols.flownCol];
  const schoolRaw = String(manualRow[cols.schoolCol] ?? "").trim();

  const planMan = planManRaw != null && planManRaw !== "" ? Number(planManRaw) : null;
  const flown = flownRaw === 1 || flownRaw === true ? 1 : 0;
  const school = schoolRaw === "sau_utek" || schoolRaw === "by" ? schoolRaw : "";

  return {
    auto_plan: autoPlan,
    plan: planMan !== null ? planMan : autoPlan,
    plan_manual: planMan,
    flown,
    school,
  };
}

type PaybarRow = { currencyID: number; due: number; paid: number };

function paybarRowsFromPlanAndMoney(
  planRows: Array<{ currencyID?: number; sum_plan?: number }>,
  moneyRows: Array<{ currencyID?: number; sum_payed?: number }>
): PaybarRow[] {
  const dueBy: Record<number, number> = {};
  for (const r of planRows) {
    const cid = r.currencyID ?? 0;
    if (cid > 0) dueBy[cid] = (dueBy[cid] ?? 0) + (r.sum_plan ?? 0);
  }
  const paidBy: Record<number, number> = {};
  for (const r of moneyRows) {
    const cid = r.currencyID ?? 0;
    if (cid > 0) paidBy[cid] = (paidBy[cid] ?? 0) + (r.sum_payed ?? 0);
  }
  const cids = [...new Set([...Object.keys(dueBy), ...Object.keys(paidBy)])].map(Number).sort((a, b) => a - b);
  const out: PaybarRow[] = [];
  const eps = 1e-4;
  for (const cid of cids) {
    const due = dueBy[cid] ?? 0;
    const paid = paidBy[cid] ?? 0;
    if (due < eps && paid < eps) continue;
    out.push({ currencyID: cid, due, paid });
  }
  return out;
}

export function overdueRemainingFromPlanAndPaid(
  planRows: Array<{ currencyID?: number; sum_plan?: number }>,
  moneyRows: Array<{ currencyID?: number; sum_payed?: number }>
): Array<{ currencyID: number; remaining: number }> {
  return paybarRowsFromPlanAndMoney(planRows, moneyRows)
    .map((pb) => ({
      currencyID: pb.currencyID,
      remaining: Math.max(0, Math.round((pb.due - pb.paid) * 100) / 100),
    }))
    .filter((r) => r.remaining > 0.009);
}

export function studentPaidBehindDuePlan(
  planRows: Array<{ currencyID?: number; sum_plan?: number }>,
  moneyRows: Array<{ currencyID?: number; sum_payed?: number }>
): boolean {
  const eps = 1e-4;
  const tolerance = 0.01;
  for (const pb of paybarRowsFromPlanAndMoney(planRows, moneyRows)) {
    if (pb.due >= eps && pb.paid + tolerance < pb.due) return true;
  }
  return false;
}

export function contractInstallmentMismatch(
  moneyRows: Array<{ currencyID?: number; sum_price?: number }>,
  scheduleRows: Array<{ currencyID?: number; sum_schedule?: number }>,
  tolerance = 1.0
): boolean {
  const byContract: Record<number, number> = {};
  for (const r of moneyRows) {
    const cid = r.currencyID ?? 0;
    if (cid > 0) byContract[cid] = (byContract[cid] ?? 0) + (r.sum_price ?? 0);
  }
  const bySchedule: Record<number, number> = {};
  for (const r of scheduleRows) {
    const cid = r.currencyID ?? 0;
    if (cid > 0) bySchedule[cid] = (bySchedule[cid] ?? 0) + (r.sum_schedule ?? 0);
  }
  const cids = [...new Set([...Object.keys(byContract), ...Object.keys(bySchedule)])].map(Number).sort((a, b) => a - b);
  for (const cid of cids) {
    const a = byContract[cid] ?? 0;
    const b = bySchedule[cid] ?? 0;
    if (a <= 0 && b <= 0) continue;
    if (Math.abs(a - b) > tolerance) return true;
  }
  return false;
}

export function labelTextColor(hex: string): string {
  if (!hex || hex[0] !== "#" || hex.length < 7) return "#111";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const y = (r * 299 + g * 587 + b * 114) / 1000;
  return y > 160 ? "#111" : "#fff";
}

const AYLAR: Record<number, string> = {
  1: "Ocak", 2: "Şubat", 3: "Mart", 4: "Nisan", 5: "Mayıs", 6: "Haziran",
  7: "Temmuz", 8: "Ağustos", 9: "Eylül", 10: "Ekim", 11: "Kasım", 12: "Aralık",
};

export function fmtTrDate(d: Date | null): string {
  if (!d) return "—";
  const g = d.getDate();
  const a = AYLAR[d.getMonth() + 1] ?? "";
  const y = d.getFullYear();
  return `${g} ${a} ${y}`;
}

/** Tarih metni — saat dilimi kayması yok (YYYY-MM-DD) */
export function fmtIsoDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "—";
  const gun = Number(m[3]);
  const a = AYLAR[Number(m[2])] ?? "";
  return `${gun} ${a} ${m[1]}`;
}

export function isPplTheoryTraining(name: string): boolean {
  const l = name.trim().toLowerCase();
  if (l === "ppl teori") return true;
  if (l.includes("ppl") && l.includes("theor")) return true;
  return false;
}
