import { rows as dbRows } from "./db";
import { ODT_DEFAULT_ACTIVE_CORP_IDS, ODT_DEFAULT_CORP_LABEL_IDS, varsayilanAktifEtiketler } from "./corp-etiket";
import { aktifOkul } from "./okul-istek";
import {
  autoplanFromContractEur,
  studentPaidBehindDuePlan,
  contractInstallmentMismatch,
  ratingBitState,
  type RatingBitId,
} from "./hesaplamalar";

export { ODT_DEFAULT_ACTIVE_CORP_IDS, ODT_DEFAULT_CORP_LABEL_IDS };

export type CurrencyInfo = { id: number; symbol: string; shortcode: string; isEur: boolean };
export type MoneyRow = { currencyID: number; sum_price: number; sum_payed: number };
export type PlanDueRow = { currencyID: number; sum_plan: number };
export type ScheduleRow = { currencyID: number; sum_schedule: number };
export type TrainingCell = { plan: number; done: number };

export type OgrenciRow = {
  mId: number;
  firstName: string;
  lastName: string;
  shortCode: string | null;
  trainingStatus: string | null;
  facilityId: string | null;
  facilityName: string | null;
  fleetId: number | null;
  fleetName: string | null;
  corpLabelId: number | null;
  corpLabelName: string | null;
  corpLabelColor: string | null;
  subjects: string;
  subjectsExtra: string;
  money: MoneyRow[];
  moneyExtra: MoneyRow[];
  planDue: PlanDueRow[];
  scheduleTotal: ScheduleRow[];
  paidBehind: boolean;
  hasInstallMismatch: boolean;
  autoPlan: number;
  pplExtraMinutes: number;
  trainings: Record<string, TrainingCell>;
  ratingBits: Record<RatingBitId, ReturnType<typeof ratingBitState>>;
  lastNote: string | null;
  lastNoteAuthor: string | null;
  lastNoteAt: string | null;
};

export type OgrenciListFilters = {
  fleet?: number;
  facility?: string;
  group?: string;
  student?: number;
  corp?: number[];
  corpFormSubmitted?: boolean;
  search?: string;
  grad?: boolean;
  susp?: boolean;
  excludePplGrad?: boolean;
};

export async function getCurrencyMap(): Promise<{ currencies: CurrencyInfo[]; isEurMap: Record<number, boolean>; symbolMap: Record<number, string> }> {
  const rows = await dbRows<{ m_ID: number; symbol: string; shortcode: string }>("odt_ogrenci_currencies");
  const currencies: CurrencyInfo[] = (rows as Array<{ m_ID: number; symbol: string; shortcode: string }>).map((r) => ({
    id: r.m_ID,
    symbol: r.symbol ?? "€",
    shortcode: r.shortcode ?? "",
    isEur: (r.shortcode ?? "").toUpperCase() === "EUR" || (r.symbol ?? "").includes("€"),
  }));
  const isEurMap: Record<number, boolean> = {};
  const symbolMap: Record<number, string> = {};
  for (const c of currencies) {
    isEurMap[c.id] = c.isEur;
    symbolMap[c.id] = c.symbol;
  }
  return { currencies, isEurMap, symbolMap };
}

export async function getFilters() {
  const [fleets, facilities, corpLabels, groups] = await Promise.all([
    dbRows<{ m_ID: number; name: string }>("odt_ogrenci_filter_fleets"),
    dbRows<{ m_ID: number; name: string }>("odt_ogrenci_filter_facilities"),
    dbRows<{ m_ID: number; name: string; color: string }>("odt_ogrenci_filter_corp_labels"),
    dbRows<{ m_ID: number; code: string; facilityID: number; fleetID: number; fleet_name: string }>(
      "odt_ogrenci_filter_groups"
    ),
  ]);
  return { fleets, facilities, corpLabels, groups };
}

export async function getCorpLabelCounts(): Promise<Record<number, number>> {
  const rows = await dbRows<{ id: number; c: number }>("odt_ogrenci_corp_label_counts");
  const out: Record<number, number> = {};
  for (const r of rows as Array<{ id: number; c: number }>) out[r.id] = Number(r.c);
  return out;
}

export async function getOgrenciList(filters: OgrenciListFilters): Promise<OgrenciRow[]> {
  const { isEurMap, symbolMap } = await getCurrencyMap();

  // Corp filter
  let activeCorpIds: number[] = [];
  if (filters.corpFormSubmitted) {
    activeCorpIds = filters.corp ?? [];
  } else {
    activeCorpIds = varsayilanAktifEtiketler(await aktifOkul());
  }

  // Süzgeçler odt_ogrenci_list içinde sabit koşullardır; boş olanlar null gider.
  // grad varsayılan: mezunlar gizli · susp varsayılan: askıdakiler gizli
  // Etiket süzgeci — tek öğrenci açıkken fonksiyon etiketi yok sayar (doğrudan o kişi)
  type StudentRaw = {
    m_ID: number;
    firstName: string | null;
    lastName: string | null;
    shortCode: string | null;
    trainingStatus: string | null;
    facilityId: string | null;
    facilityName: string | null;
    fleetId: number | null;
    fleetName: string | null;
    corpLabelId: number | null;
    corpLabelName: string | null;
    corpLabelColor: string | null;
  };

  const corpIds = filters.student ? [] : activeCorpIds;
  const students = await dbRows<StudentRaw>("odt_ogrenci_list", {
    p_grad: !!filters.grad,
    p_susp: !!filters.susp,
    p_exclude_ppl_grad: !!filters.excludePplGrad,
    p_fleet: filters.fleet || null,
    p_facility: filters.facility || null,
    p_group: filters.group || null,
    p_student: filters.student || null,
    p_search: filters.search || null,
    p_corp_ids: corpIds.filter((id) => id > 0),
    p_corp_no_label: corpIds.includes(-1),
  });

  if (students.length === 0) return [];

  const studentIds = (students as StudentRaw[]).map((s) => s.m_ID);
  const idArgs = { p_ids: studentIds };

  // Training deduplication
  type TrainDedupeRow = { studentID: number; keep_id: number };
  const trainKeepRows = await dbRows<TrainDedupeRow>("odt_ogrenci_train_keep", idArgs);

  const trainKeepIds = [...new Set((trainKeepRows as TrainDedupeRow[]).map((r) => r.keep_id).filter((id: number) => id > 0))];
  const keepArgs = trainKeepIds.length > 0 ? { p_keep_ids: trainKeepIds } : null;

  // Contract subjects (non-extra)
  type SubjectRow = { studentID: number; subjects: string | null };
  const contractSubjects: Record<number, string> = {};
  if (keepArgs) {
    const subjectRows = await dbRows<SubjectRow>("odt_ogrenci_subjects", keepArgs);
    for (const r of subjectRows as SubjectRow[]) contractSubjects[r.studentID] = r.subjects ?? "";
  }

  // Extra contract subjects
  type ExtraSubjectRow = { studentID: number; subjects_extra: string | null };
  const contractSubjectsExtra: Record<number, string> = {};
  const extraSubjectRows = await dbRows<ExtraSubjectRow>("odt_ogrenci_subjects_extra", idArgs);
  for (const r of extraSubjectRows as ExtraSubjectRow[]) contractSubjectsExtra[r.studentID] = r.subjects_extra ?? "";

  // Money per student (non-extra contracts) — price + payed
  type MoneyRaw = { studentID: number; currencyID: number; sum_price: number; sum_payed: number };
  const contractMoneyByStudent: Record<number, MoneyRow[]> = {};
  const moneyRows = await dbRows<MoneyRaw>("odt_ogrenci_money", idArgs);
  for (const r of moneyRows as MoneyRaw[]) {
    if (!contractMoneyByStudent[r.studentID]) contractMoneyByStudent[r.studentID] = [];
    contractMoneyByStudent[r.studentID].push({ currencyID: Number(r.currencyID), sum_price: Number(r.sum_price), sum_payed: Number(r.sum_payed) });
  }

  // Extra contract money
  const contractMoneyExtraByStudent: Record<number, MoneyRow[]> = {};
  const moneyExtraRows = await dbRows<MoneyRaw>("odt_ogrenci_money_extra", idArgs);
  for (const r of moneyExtraRows as MoneyRaw[]) {
    if (!contractMoneyExtraByStudent[r.studentID]) contractMoneyExtraByStudent[r.studentID] = [];
    contractMoneyExtraByStudent[r.studentID].push({ currencyID: Number(r.currencyID), sum_price: Number(r.sum_price), sum_payed: Number(r.sum_payed) });
  }

  // Plan due (installments due today)
  type PlanDueRaw = { studentID: number; currencyID: number; sum_plan: number };
  const planDueByStudent: Record<number, PlanDueRow[]> = {};
  const planDueRows = await dbRows<PlanDueRaw>("odt_ogrenci_plan_due", idArgs);
  for (const r of planDueRows as PlanDueRaw[]) {
    if (!planDueByStudent[r.studentID]) planDueByStudent[r.studentID] = [];
    planDueByStudent[r.studentID].push({ currencyID: Number(r.currencyID), sum_plan: Number(r.sum_plan) });
  }

  // Schedule total (all installments, no date filter) — TOPLAM ÖDEME PLANI
  type ScheduleRaw = { studentID: number; currencyID: number; sum_schedule: number };
  const scheduleTotalByStudent: Record<number, ScheduleRow[]> = {};
  const scheduleRows = await dbRows<ScheduleRaw>("odt_ogrenci_schedule_total", idArgs);
  for (const r of scheduleRows as ScheduleRaw[]) {
    if (!scheduleTotalByStudent[r.studentID]) scheduleTotalByStudent[r.studentID] = [];
    scheduleTotalByStudent[r.studentID].push({ currencyID: Number(r.currencyID), sum_schedule: Number(r.sum_schedule) });
  }

  // PPL Extra flight minutes (paidFlight=1, realized=1, not canceled, not control)
  type PplExtraRow = { studentID: number; minutes: number };
  const pplExtraByStudent: Record<number, number> = {};
  const pplExtraRows = await dbRows<PplExtraRow>("odt_ogrenci_ppl_extra", idArgs);
  for (const r of pplExtraRows as PplExtraRow[]) pplExtraByStudent[r.studentID] = Number(r.minutes);

  // Training minutes per student
  type TrainRow = { studentID: number; tname: string; plan_m: number; done_m: number };
  const trainingsByStudent: Record<number, Record<string, TrainingCell>> = {};
  if (keepArgs) {
    const trainRows = await dbRows<TrainRow>("odt_ogrenci_train_minutes", keepArgs);
    for (const r of trainRows as TrainRow[]) {
      if (!trainingsByStudent[r.studentID]) trainingsByStudent[r.studentID] = {};
      trainingsByStudent[r.studentID][r.tname] = { plan: Number(r.plan_m), done: Number(r.done_m) };
    }
  }

  // Student bits (rating)
  type BitRaw = Record<string, unknown> & { student_id: number };
  const bitsByStudent: Record<number, BitRaw> = {};
  const bitRows = await dbRows<BitRaw>("odt_ogrenci_bits", idArgs);
  for (const r of bitRows as BitRaw[]) bitsByStudent[r.student_id] = r;

  // Latest note per student
  type NoteRaw = { student_id: number; body: string; author_name: string; created_at: Date | string };
  const notesByStudent: Record<number, NoteRaw> = {};
  const noteRows = await dbRows<NoteRaw>("odt_ogrenci_last_notes", idArgs);
  for (const r of noteRows as NoteRaw[]) notesByStudent[r.student_id] = r;

  // Build output rows
  return (students as StudentRaw[]).map((s) => {
    const sid = s.m_ID;
    const money = contractMoneyByStudent[sid] ?? [];
    const planDue = planDueByStudent[sid] ?? [];
    const scheduleTotal = scheduleTotalByStudent[sid] ?? [];
    const manualRow = (bitsByStudent[sid] ?? {}) as Record<string, unknown>;
    const autoPlan = autoplanFromContractEur(money, isEurMap);
    const note = notesByStudent[sid];

    // Installment mismatch check
    const moneyForMismatch = money.map((m) => ({ currencyID: m.currencyID, sum_price: m.sum_price }));
    const hasInstallMismatch = contractInstallmentMismatch(moneyForMismatch, scheduleTotal);

    return {
      mId: sid,
      firstName: s.firstName ?? "",
      lastName: s.lastName ?? "",
      shortCode: s.shortCode,
      trainingStatus: s.trainingStatus,
      facilityId: s.facilityId,
      facilityName: s.facilityName,
      fleetId: s.fleetId,
      fleetName: s.fleetName,
      corpLabelId: s.corpLabelId,
      corpLabelName: s.corpLabelName,
      corpLabelColor: s.corpLabelColor,
      subjects: contractSubjects[sid] ?? "",
      subjectsExtra: contractSubjectsExtra[sid] ?? "",
      money,
      moneyExtra: contractMoneyExtraByStudent[sid] ?? [],
      planDue,
      scheduleTotal,
      paidBehind: studentPaidBehindDuePlan(
        planDue,
        money.map((m) => ({ currencyID: m.currencyID, sum_payed: m.sum_payed }))
      ),
      hasInstallMismatch,
      autoPlan,
      pplExtraMinutes: pplExtraByStudent[sid] ?? 0,
      trainings: trainingsByStudent[sid] ?? {},
      ratingBits: {
        cpl: ratingBitState("cpl", manualRow, autoPlan),
        ir: ratingBitState("ir", manualRow, autoPlan),
        me: ratingBitState("me", manualRow, autoPlan),
        atpl: ratingBitState("atpl", manualRow, autoPlan),
      },
      lastNote: note?.body ?? null,
      lastNoteAuthor: note?.author_name ?? null,
      lastNoteAt: note?.created_at
        ? (note.created_at instanceof Date ? note.created_at.toISOString() : String(note.created_at))
        : null,
    };
  });
}

export async function getStudentDropdownList(): Promise<Array<{ m_ID: number; label: string }>> {
  const rows = await dbRows<{ m_ID: number; firstName: string; lastName: string }>("odt_ogrenci_dropdown");
  return (rows as Array<{ m_ID: number; firstName: string; lastName: string }>).map((r) => ({
    m_ID: r.m_ID,
    label: `${r.lastName} ${r.firstName}`.trim(),
  }));
}
