import { rows as dbRows, run } from "./db";
import { studentPaidBehindDuePlan } from "./hesaplamalar";
import { getCurrencyMap, type MoneyRow, type PlanDueRow, type ScheduleRow } from "./ogrenci";

export const PIC_HOME_ICAO = "LTFH";

export type PicUcus = {
  date: string;
  duty: string;
  route: string;
  minutes: number;
  icaos: string[];
};

export type PicUcMeydanGun = {
  date: string;
  flights: PicUcus[];
};

export type PicTakipRow = {
  mId: number;
  firstName: string;
  lastName: string;
  shortCode: string | null;
  planMin: number;
  doneMin: number;
  remainMin: number;
  money: MoneyRow[];
  scheduleTotal: ScheduleRow[];
  planDue: PlanDueRow[];
  paidBehind: boolean;
  datesText: string;
  ucMeydan: PicUcMeydanGun[];
  disMeydan: PicUcus[];
};

export type PicTakipPageData = {
  rows: PicTakipRow[];
  symbolMap: Record<number, string>;
  totalPlanMin: number;
  totalRemainMin: number;
};

type StudentRaw = {
  m_ID: number;
  firstName: string;
  lastName: string;
  shortCode: string | null;
};

type TrainRaw = { studentID: number; plan_m: number; done_m: number };

type FlightRaw = {
  studentID: number;
  flightDate: string | null;
  dutyName: string | null;
  routeName: string | null;
  baseFrom: string | null;
  baseTo: string | null;
  minutes: number;
};

type DateRaw = { student_id: number; katilacagi_tarihler: string };

export function picFmtMin(m: number): string {
  const n = Math.max(0, Math.round(Number(m) || 0));
  const h = Math.floor(n / 60);
  const mm = n % 60;
  return `${h}:${String(mm).padStart(2, "0")}`;
}

export function isPicDuty(duty: string): boolean {
  const d = String(duty ?? "")
    .trim()
    .toUpperCase()
    .replace(/İ/g, "I");
  if (!d) return false;
  if (d === "PIC") return true;
  return d.startsWith("PIC-") || d.startsWith("PIC ") || d.startsWith("PIC(");
}

export function icaoList(route: string): string[] {
  const u = String(route ?? "")
    .toUpperCase()
    .replace(/İ/g, "I");
  return u
    .split(/[^A-Z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => /^[A-Z]{4}$/.test(t));
}

function asIcao(value: string): string {
  const t = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/İ/g, "I");
  return /^[A-Z]{4}$/.test(t) ? t : "";
}

export function flightIcaos(from: string, to: string, routeName: string): string[] {
  const a: string[] = [];
  const f = asIcao(from);
  const t = asIcao(to);
  if (f) a.push(f);
  if (t) a.push(t);
  if (!a.length) a.push(...icaoList(routeName));
  return a;
}

export function displayRoute(from: string, to: string, routeName: string): string {
  const f = asIcao(from) || String(from ?? "").trim().toUpperCase();
  const t = asIcao(to) || String(to ?? "").trim().toUpperCase();
  if (f && t) return `${f}-${t}`;
  const rn = String(routeName ?? "").trim();
  return rn || "—";
}

export function hasDisMeydan(icaos: string[]): boolean {
  return icaos.some((code) => code !== PIC_HOME_ICAO);
}

export function uniqueNonHomeLandings(icaos: string[]): string[] {
  const land = icaos.length >= 2 ? icaos.slice(1) : icaos;
  return [...new Set(land.filter((code) => code !== PIC_HOME_ICAO))];
}

export async function savePicTakipTarihler(studentId: number, datesText: string): Promise<void> {
  const text = String(datesText ?? "").slice(0, 4000);
  await run("odt_pic_tarih_upsert", { p_student_id: studentId, p_text: text });
}

function toUcus(r: FlightRaw): PicUcus | null {
  const date = String(r.flightDate ?? "").slice(0, 10);
  if (!date || date.startsWith("0000")) return null;
  const from = String(r.baseFrom ?? "");
  const to = String(r.baseTo ?? "");
  const routeName = String(r.routeName ?? "");
  return {
    date,
    duty: String(r.dutyName ?? "").trim(),
    route: displayRoute(from, to, routeName),
    minutes: Number(r.minutes) || 0,
    icaos: flightIcaos(from, to, routeName),
  };
}

function buildUcMeydan(picFlights: PicUcus[]): PicUcMeydanGun[] {
  const byDay = new Map<string, PicUcus[]>();
  for (const f of picFlights) {
    const list = byDay.get(f.date) ?? [];
    list.push(f);
    byDay.set(f.date, list);
  }
  const out: PicUcMeydanGun[] = [];
  for (const [date, flights] of byDay) {
    const landings = new Set<string>();
    for (const f of flights) {
      for (const code of uniqueNonHomeLandings(f.icaos)) landings.add(code);
    }
    if (landings.size >= 2) out.push({ date, flights });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export async function getPicTakipPageData(): Promise<PicTakipPageData> {
  const { symbolMap } = await getCurrencyMap();

  const students = await dbRows<StudentRaw>("odt_pic_students");

  if (!students.length) {
    return { rows: [], symbolMap, totalPlanMin: 0, totalRemainMin: 0 };
  }

  const studentIds = students.map((s) => s.m_ID);
  const ids = { p_ids: studentIds };

  const [trainRows, moneyRows, scheduleRows, planDueRows, flightRows, dateRows] = await Promise.all([
    dbRows<TrainRaw>("odt_pic_trainings", ids),
    dbRows<{ studentID: number; currencyID: number; sum_price: number; sum_payed: number }>("odt_pic_money", ids),
    dbRows<{ studentID: number; currencyID: number; sum_schedule: number }>("odt_pic_schedule", ids),
    dbRows<{ studentID: number; currencyID: number; sum_plan: number }>("odt_pic_plan_due", ids),
    dbRows<FlightRaw>("odt_pic_flights", ids),
    dbRows<DateRaw>("odt_pic_tarihler", ids),
  ]);

  const trainBy: Record<number, { plan: number; done: number }> = {};
  for (const r of trainRows) trainBy[r.studentID] = { plan: Number(r.plan_m) || 0, done: Number(r.done_m) || 0 };

  const moneyBy: Record<number, MoneyRow[]> = {};
  for (const r of moneyRows) {
    if (!moneyBy[r.studentID]) moneyBy[r.studentID] = [];
    moneyBy[r.studentID].push({
      currencyID: Number(r.currencyID),
      sum_price: Number(r.sum_price),
      sum_payed: Number(r.sum_payed),
    });
  }

  const scheduleBy: Record<number, ScheduleRow[]> = {};
  for (const r of scheduleRows) {
    if (!scheduleBy[r.studentID]) scheduleBy[r.studentID] = [];
    scheduleBy[r.studentID].push({ currencyID: Number(r.currencyID), sum_schedule: Number(r.sum_schedule) });
  }

  const planDueBy: Record<number, PlanDueRow[]> = {};
  for (const r of planDueRows) {
    if (!planDueBy[r.studentID]) planDueBy[r.studentID] = [];
    planDueBy[r.studentID].push({ currencyID: Number(r.currencyID), sum_plan: Number(r.sum_plan) });
  }

  const picBy: Record<number, PicUcus[]> = {};
  const disBy: Record<number, PicUcus[]> = {};
  for (const raw of flightRows) {
    const u = toUcus(raw);
    if (!u) continue;
    const sid = Number(raw.studentID);
    if (isPicDuty(u.duty)) {
      if (!picBy[sid]) picBy[sid] = [];
      picBy[sid].push(u);
    }
    if (hasDisMeydan(u.icaos)) {
      if (!disBy[sid]) disBy[sid] = [];
      disBy[sid].push(u);
    }
  }

  const datesBy: Record<number, string> = {};
  for (const r of dateRows) datesBy[Number(r.student_id)] = r.katilacagi_tarihler ?? "";

  const rows: PicTakipRow[] = students.map((s) => {
    const sid = s.m_ID;
    const planMin = trainBy[sid]?.plan ?? 0;
    const doneMin = trainBy[sid]?.done ?? 0;
    const remainMin = Math.max(0, planMin - doneMin);
    const money = moneyBy[sid] ?? [];
    const scheduleTotal = scheduleBy[sid] ?? [];
    const planDue = planDueBy[sid] ?? [];
    return {
      mId: sid,
      firstName: s.firstName ?? "",
      lastName: s.lastName ?? "",
      shortCode: s.shortCode,
      planMin,
      doneMin,
      remainMin,
      money,
      scheduleTotal,
      planDue,
      paidBehind: studentPaidBehindDuePlan(
        planDue,
        money.map((m) => ({ currencyID: m.currencyID, sum_payed: m.sum_payed }))
      ),
      datesText: datesBy[sid] ?? "",
      ucMeydan: buildUcMeydan(picBy[sid] ?? []),
      disMeydan: disBy[sid] ?? [],
    };
  });

  return {
    rows,
    symbolMap,
    totalPlanMin: rows.reduce((a, r) => a + r.planMin, 0),
    totalRemainMin: rows.reduce((a, r) => a + r.remainMin, 0),
  };
}
