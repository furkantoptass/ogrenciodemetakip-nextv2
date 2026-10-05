import { rows } from "./db";
import { labelTextColor } from "./hesaplamalar";
import { ODT_DEFAULT_CORP_LABEL_IDS } from "./ogrenci";

export const HAT_PPL_DEFAULT_CORP_IDS = ODT_DEFAULT_CORP_LABEL_IDS.filter((id) => id !== 875 && id !== 1090);

export type HatPplStage = "teori" | "stpl" | "first_solo" | "dual" | "ir" | "xc" | "st";
export type HatPplRevision = "rev2" | "rev3";

export const HAT_PPL_STAGE_ORDER: HatPplStage[] = [
  "teori",
  "stpl",
  "first_solo",
  "dual",
  "ir",
  "xc",
  "st",
];

export const HAT_PPL_STAGE_CONFIG: Record<HatPplStage, { label: string; color: string; light: string }> = {
  teori: { label: "TEORİ", color: "#607d8b", light: "#eceff1" },
  stpl: { label: "StPL", color: "#1976d2", light: "#e3f2fd" },
  first_solo: { label: "First Solo", color: "#e65100", light: "#fff3e0" },
  dual: { label: "DUAL", color: "#f57f17", light: "#fffde7" },
  ir: { label: "IR", color: "#6a1b9a", light: "#f3e5f5" },
  xc: { label: "XC", color: "#00838f", light: "#e0f7fa" },
  st: { label: "S/T", color: "#b71c1c", light: "#ffebee" },
};

export type HatPplFilters = {
  q: string;
  fleet: number;
  facility: number;
  group: number;
  student: number;
  showGraduates: boolean;
  showSuspended: boolean;
  excludePplGrads: boolean;
  corpFormSubmitted: boolean;
  activeCorpIds: number[];
  showAllCorpLabels: boolean;
};

export type HatPplNazari = {
  passed: boolean;
  has_any: boolean;
  x: number;
  n: number;
  legacy?: boolean;
};

export type HatPplStudent = {
  m_ID: number;
  firstName: string;
  lastName: string;
  shortCode: string;
  corpLabelID: number;
  corp_label_name: string;
  corp_label_color: string;
  fleet_name: string;
  stpl_no: string;
  stpl_start_date: string;
  stpl_var: number;
  ucus_sayisi: number;
  ppl_revision_id: number;
  ppl_duration: number;
  ppl_done: number;
  extra_min: number;
  e15b: number;
  e19_var: number;
  e24a_var: number;
  e25b: number;
  e20_var: number;
  e26_var: number;
  e29b_var: number;
  last_date: string;
  last_duty: string;
  last_instr: string;
  last_curriculum_duty: string;
  e1_first_date: string;
  first_flight_date: string;
  e15b_first_date: string;
  e19_first_date: string;
  e24a_first_date: string;
  e25b_first_date: string;
  e20_first_date: string;
  e26_first_date: string;
  e29b_first_date: string;
};

export type HatPplCard = {
  student: HatPplStudent;
  stage: HatPplStage;
  href: string;
  fleetLbl: string;
  lastDateFmt: string;
  showCurrBadge: boolean;
  rev: HatPplRevision | "";
  cbg: string;
  ctx: string;
  pplDur: number;
  extraMin: number;
  curriculum: number;
  remaining: number;
  kalanClass: string;
  e1Text: string;
  stageText: string;
  nazari: HatPplNazari | null;
};

export type HatPplColumn = {
  key: HatPplStage;
  label: string;
  color: string;
  light: string;
  remainingMin: number;
  cards: HatPplCard[];
};

export type HatPplFilterOptions = {
  fleets: Array<{ m_ID: number; name: string }>;
  facilities: Array<{ m_ID: number; name: string }>;
  groups: Array<{ m_ID: number; code: string; fleet_name: string | null }>;
  students: Array<{ m_ID: number; firstName: string; lastName: string }>;
  corpLabelsCore: Array<{ m_ID: number; name: string; color: string }>;
  corpLabelsExtra: Array<{ m_ID: number; name: string; color: string }>;
};

export type HatPplPageData = {
  filters: HatPplFilters;
  options: HatPplFilterOptions;
  columns: HatPplColumn[];
  studentCount: number;
  grandTotalRem: number;
};

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "bigint") return Number(v);
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function str(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    const iso = v.toISOString();
    return iso.startsWith("0000") ? "" : iso.slice(0, 10);
  }
  return String(v);
}

function ymd(v: unknown): string {
  const raw = str(v).trim();
  if (raw === "" || raw.startsWith("0000")) return "";
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

/** PHP hat_durumu_revision */
export function hatDurumuRevision(s: Pick<HatPplStudent, "ppl_revision_id">): HatPplRevision {
  return num(s.ppl_revision_id) === 472 ? "rev3" : "rev2";
}

/** PHP hat_durumu_stage */
export function hatDurumuStage(s: HatPplStudent): HatPplStage {
  const ucus = num(s.ucus_sayisi);
  const stpl = num(s.stpl_var);
  const e15b = num(s.e15b);

  if (ucus === 0) {
    return stpl > 0 ? "stpl" : "teori";
  }
  if (e15b === 0) {
    return "first_solo";
  }

  if (hatDurumuRevision(s) === "rev3") {
    if (!num(s.e20_var)) return "dual";
    if (!num(s.e26_var)) return "ir";
    if (!num(s.e29b_var)) return "xc";
    return "st";
  }
  if (!num(s.e19_var)) return "dual";
  if (!num(s.e24a_var)) return "ir";
  if (!num(s.e25b)) return "xc";
  return "st";
}

/** PHP hat_durumu_fmt_min — 0 da 0:00 */
export function hatDurumuFmtMin(m: number): string {
  const n = Math.trunc(m);
  const h = Math.trunc(n / 60);
  const mm = ((n % 60) + 60) % 60;
  return `${h}:${String(mm).padStart(2, "0")}`;
}

function istanbulTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** PHP hat_durumu_days_since — Europe/Istanbul takvim günü */
export function hatDurumuDaysSince(dateYmd: string | null | undefined): number | null {
  const raw = String(dateYmd ?? "").trim();
  if (raw === "" || raw.startsWith("0000")) return null;
  const day = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const startUtc = Date.parse(`${day}T00:00:00Z`);
  const todayUtc = Date.parse(`${istanbulTodayYmd()}T00:00:00Z`);
  if (Number.isNaN(startUtc) || Number.isNaN(todayUtc)) return null;
  return Math.max(0, Math.round((todayUtc - startUtc) / 86_400_000));
}

function pickYmd(s: HatPplStudent, key: keyof HatPplStudent): string | null {
  const v = ymd(s[key]);
  return v || null;
}

/** PHP hat_durumu_stage_entry_date */
export function hatDurumuStageEntryDate(s: HatPplStudent, stage: HatPplStage): string | null {
  switch (stage) {
    case "teori":
      return null;
    case "stpl":
      return pickYmd(s, "stpl_start_date");
    case "first_solo":
      return pickYmd(s, "first_flight_date");
    case "dual":
      return pickYmd(s, "e15b_first_date");
    case "ir":
      return hatDurumuRevision(s) === "rev3" ? pickYmd(s, "e20_first_date") : pickYmd(s, "e19_first_date");
    case "xc":
      return hatDurumuRevision(s) === "rev3" ? pickYmd(s, "e26_first_date") : pickYmd(s, "e24a_first_date");
    case "st":
      return hatDurumuRevision(s) === "rev3" ? pickYmd(s, "e29b_first_date") : pickYmd(s, "e25b_first_date");
    default:
      return null;
  }
}

/** PHP: plan yoksa 2790; uçulan = done − extra; kalan = plan − uçulan */
export function hatDurumuHours(s: HatPplStudent): { pplDur: number; extraMin: number; curriculum: number; remaining: number } {
  let pplDur = Math.max(0, num(s.ppl_duration) || 2790);
  if (pplDur === 0) pplDur = 2790;
  const pplDone = num(s.ppl_done);
  const extraMin = num(s.extra_min);
  const curriculum = Math.max(0, pplDone - extraMin);
  const remaining = Math.max(0, pplDur - curriculum);
  return { pplDur, extraMin, curriculum, remaining };
}

export function hatDurumuKalanClass(remaining: number): string {
  if (remaining >= 300) return "hd-h-kalan-green";
  if (remaining >= 120) return "hd-h-kalan-yellow";
  return "hd-h-kalan-red";
}

function fmtDmY(raw: string): string {
  const day = ymd(raw);
  if (!day) return "";
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

function fleetLbl(fleetRaw: string): string {
  const m = fleetRaw.match(/^(\d+)/);
  if (m) return m[1];
  return [...fleetRaw].slice(0, 8).join("");
}

function daysText(n: number | null): string {
  return n === null ? "—" : `${n} gün`;
}

function mapStudent(row: Record<string, unknown>): HatPplStudent {
  return {
    m_ID: num(row.m_ID),
    firstName: str(row.firstName).trim(),
    lastName: str(row.lastName).trim(),
    shortCode: str(row.shortCode).trim(),
    corpLabelID: num(row.corpLabelID),
    corp_label_name: str(row.corp_label_name).trim(),
    corp_label_color: str(row.corp_label_color).trim(),
    fleet_name: str(row.fleet_name).trim(),
    stpl_no: str(row.stpl_no).trim(),
    stpl_start_date: ymd(row.stpl_start_date),
    stpl_var: num(row.stpl_var),
    ucus_sayisi: num(row.ucus_sayisi),
    ppl_revision_id: num(row.ppl_revision_id),
    ppl_duration: num(row.ppl_duration),
    ppl_done: num(row.ppl_done),
    extra_min: num(row.extra_min),
    e15b: num(row.e15b),
    e19_var: num(row.e19_var),
    e24a_var: num(row.e24a_var),
    e25b: num(row.e25b),
    e20_var: num(row.e20_var),
    e26_var: num(row.e26_var),
    e29b_var: num(row.e29b_var),
    last_date: ymd(row.last_date),
    last_duty: str(row.last_duty).trim(),
    last_instr: str(row.last_instr).trim(),
    last_curriculum_duty: str(row.last_curriculum_duty).trim(),
    e1_first_date: ymd(row.e1_first_date),
    first_flight_date: ymd(row.first_flight_date),
    e15b_first_date: ymd(row.e15b_first_date),
    e19_first_date: ymd(row.e19_first_date),
    e24a_first_date: ymd(row.e24a_first_date),
    e25b_first_date: ymd(row.e25b_first_date),
    e20_first_date: ymd(row.e20_first_date),
    e26_first_date: ymd(row.e26_first_date),
    e29b_first_date: ymd(row.e29b_first_date),
  };
}

async function loadNazari(studentIds: number[]): Promise<Record<number, HatPplNazari>> {
  const out: Record<number, HatPplNazari> = {};
  if (studentIds.length === 0) return out;
  let nazariCountedN = 0;
  try {
    const nRows = await rows<{ c: unknown }>("odt_hatppl_nazari_counted");
    nazariCountedN = num(nRows[0]?.c);
  } catch {
    return out;
  }
  if (nazariCountedN <= 0) return out;
  try {
    const nzRows = await rows<{ student_id: unknown; subj_with: unknown; x_pass: unknown }>(
      "odt_hatppl_nazari_scores",
      { p_student_ids: studentIds }
    );
    for (const nr of nzRows) {
      const nid = num(nr.student_id);
      const subjWith = num(nr.subj_with);
      const xPass = num(nr.x_pass);
      out[nid] = {
        passed: subjWith === nazariCountedN && xPass === nazariCountedN,
        has_any: subjWith > 0,
        x: xPass,
        n: nazariCountedN,
      };
    }
    const legRows = await rows<{ student_id: unknown }>("odt_hatppl_nazari_legacy", {
      p_student_ids: studentIds,
    });
    for (const lr of legRows) {
      const lid = num(lr.student_id);
      if (!out[lid]) {
        out[lid] = {
          passed: true,
          has_any: true,
          x: nazariCountedN,
          n: nazariCountedN,
          legacy: true,
        };
      }
    }
  } catch {
    return {};
  }
  return out;
}

function toCard(s: HatPplStudent, stage: HatPplStage, nazari: HatPplNazari | null): HatPplCard {
  const hours = hatDurumuHours(s);
  const clc = s.corp_label_color;
  const cbg = clc !== "" && clc[0] === "#" ? clc : "#666";
  const e1Days = hatDurumuDaysSince(s.e1_first_date || null);
  const stageDays = hatDurumuDaysSince(hatDurumuStageEntryDate(s, stage));
  return {
    student: s,
    stage,
    href: `/ogrenciler?student=${s.m_ID}`,
    fleetLbl: s.fleet_name ? fleetLbl(s.fleet_name) : "",
    lastDateFmt: fmtDmY(s.last_date),
    showCurrBadge: s.last_curriculum_duty !== "" && s.last_curriculum_duty !== s.last_duty,
    rev: num(s.ucus_sayisi) > 0 ? hatDurumuRevision(s) : "",
    cbg,
    ctx: labelTextColor(cbg),
    pplDur: hours.pplDur,
    extraMin: hours.extraMin,
    curriculum: hours.curriculum,
    remaining: hours.remaining,
    kalanClass: hatDurumuKalanClass(hours.remaining),
    e1Text: daysText(e1Days),
    stageText: daysText(stageDays),
    nazari,
  };
}

export function parseHatPplFilters(sp: Record<string, string | string[] | undefined>): HatPplFilters {
  const last = (v: string | string[] | undefined): string | undefined => {
    if (Array.isArray(v)) return v[v.length - 1];
    return typeof v === "string" ? v : undefined;
  };
  const q = (last(sp.q) ?? "").trim();
  const fleet = Number(last(sp.fleet) ?? 0) || 0;
  const facility = Number(last(sp.facility) ?? 0) || 0;
  const group = Number(last(sp.group) ?? 0) || 0;
  const student = Number(last(sp.student) ?? 0) || 0;
  const showGraduates = last(sp.grad) === "1";
  const showSuspended = last(sp.susp) !== "0";
  const excludePplGrads = last(sp.exclude_ppl_grad) !== "0";
  const corpFormSubmitted = last(sp.corp_form) === "1";
  const showAllCorpLabels = last(sp.corp_all_labels) === "1";
  const corpRaw = Array.isArray(sp.corp) ? sp.corp : sp.corp ? [sp.corp] : [];
  const parsedCorp = corpRaw.map((x) => Number(x)).filter((n) => n === -1 || n > 0);
  const uniqueCorp = [...new Set(parsedCorp)];
  if (corpFormSubmitted) {
    return {
      q,
      fleet,
      facility,
      group,
      student,
      showGraduates,
      showSuspended,
      excludePplGrads,
      corpFormSubmitted: true,
      activeCorpIds: uniqueCorp,
      showAllCorpLabels,
    };
  }
  return {
    q,
    fleet,
    facility,
    group,
    student,
    showGraduates,
    showSuspended,
    excludePplGrads,
    corpFormSubmitted: false,
    activeCorpIds: HAT_PPL_DEFAULT_CORP_IDS,
    showAllCorpLabels,
  };
}

export async function getHatPplPageData(filters: HatPplFilters): Promise<HatPplPageData> {
  const corpFilterActive = filters.corpFormSubmitted ? filters.activeCorpIds.length > 0 : true;
  const args = {
    p_q: filters.q !== "" ? filters.q : null,
    p_fleet: filters.fleet > 0 ? filters.fleet : null,
    p_facility: filters.facility > 0 ? String(filters.facility) : null,
    p_group: filters.group > 0 ? String(filters.group) : null,
    p_student: filters.student > 0 ? filters.student : null,
    p_corp_ids: corpFilterActive ? filters.activeCorpIds.filter((x) => x > 0) : [],
    p_corp_unlabeled: corpFilterActive && filters.activeCorpIds.includes(-1),
    p_exclude_ppl_grads: filters.excludePplGrads,
    p_show_graduates: filters.showGraduates,
    p_show_suspended: filters.showSuspended,
  };

  const [rawStudents, fleets, facilities, groups, studentPick, corpLabels] = await Promise.all([
    rows<Record<string, unknown>>("odt_hatppl_students", args),
    rows<{ m_ID: unknown; name: string }>("odt_hatppl_fleets"),
    rows<{ m_ID: unknown; name: string }>("odt_hatppl_facilities"),
    rows<{ m_ID: unknown; code: string; fleet_name: string | null }>("odt_hatppl_groups"),
    rows<{ m_ID: unknown; firstName: string; lastName: string }>("odt_hatppl_student_pick"),
    rows<{ m_ID: unknown; name: string; color: string }>(
      filters.showAllCorpLabels ? "odt_hatppl_corp_labels_all" : "odt_hatppl_corp_labels_used"
    ),
  ]);

  const allStudents = rawStudents.map(mapStudent);
  const nazariByStudent = await loadNazari(allStudents.map((s) => s.m_ID));

  const stages: Record<HatPplStage, HatPplStudent[]> = {
    teori: [],
    stpl: [],
    first_solo: [],
    dual: [],
    ir: [],
    xc: [],
    st: [],
  };
  for (const s of allStudents) {
    stages[hatDurumuStage(s)].push(s);
  }

  const columns: HatPplColumn[] = HAT_PPL_STAGE_ORDER.map((key) => {
    const cfg = HAT_PPL_STAGE_CONFIG[key];
    const col = stages[key];
    let remainingMin = 0;
    const cards: HatPplCard[] = [];
    for (const s of col) {
      const hours = hatDurumuHours(s);
      remainingMin += hours.remaining;
      cards.push(toCard(s, key, nazariByStudent[s.m_ID] ?? null));
    }
    return {
      key,
      label: cfg.label,
      color: cfg.color,
      light: cfg.light,
      remainingMin,
      cards,
    };
  });

  const defaultCorpSet = new Set(ODT_DEFAULT_CORP_LABEL_IDS);
  const mappedCorp = corpLabels.map((r) => ({
    m_ID: num(r.m_ID),
    name: String(r.name ?? ""),
    color: String(r.color ?? ""),
  }));

  return {
    filters,
    options: {
      fleets: fleets.map((r) => ({ m_ID: num(r.m_ID), name: String(r.name ?? "") })),
      facilities: facilities.map((r) => ({ m_ID: num(r.m_ID), name: String(r.name ?? "") })),
      groups: groups.map((r) => ({
        m_ID: num(r.m_ID),
        code: String(r.code ?? ""),
        fleet_name: r.fleet_name ?? null,
      })),
      students: studentPick.map((r) => ({
        m_ID: num(r.m_ID),
        firstName: String(r.firstName ?? ""),
        lastName: String(r.lastName ?? ""),
      })),
      corpLabelsCore: mappedCorp.filter((r) => defaultCorpSet.has(r.m_ID)),
      corpLabelsExtra: mappedCorp.filter((r) => !defaultCorpSet.has(r.m_ID)),
    },
    columns,
    studentCount: allStudents.length,
    grandTotalRem: columns.reduce((acc, c) => acc + c.remainingMin, 0),
  };
}
