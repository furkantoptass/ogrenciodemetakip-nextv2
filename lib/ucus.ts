import { rows } from "./db";

export type UcusSatir = {
  id: number;
  date: string;
  time: string;
  type: string | null;
  studentId: number | null;
  student: string;
  instructor: string;
  aircraft: string;
  duty: string;
  route: string;
  cancelNote: string;
  minutes: number;
  canceled: boolean;
};

export type UcusSayfa = {
  ozet: { total: number; realized: number; canceled: number; minutes: number; students: number };
  matched: number;
  rows: UcusSatir[];
};

export type UcusFiltreler = {
  instructors: Array<{ id: number; name: string }>;
  aircraft: Array<{ id: number; name: string }>;
};

export type UcusDurum = "realized" | "canceled" | null;

export const UCUS_LIMIT = 500;

export async function getUcusFiltreler(): Promise<UcusFiltreler> {
  const out = await rows<Partial<UcusFiltreler>>("odt_ucus_filtreler");
  return { instructors: out[0]?.instructors ?? [], aircraft: out[0]?.aircraft ?? [] };
}

export async function getUcusSayfa(f: {
  from: string;
  to: string;
  q: string | null;
  student: number | null;
  instructor: number | null;
  aircraft: number | null;
  status: UcusDurum;
}): Promise<UcusSayfa> {
  const out = await rows<Partial<UcusSayfa>>("odt_ucus_sayfa", {
    p_from: f.from,
    p_to: f.to,
    p_q: f.q,
    p_student: f.student,
    p_instructor: f.instructor,
    p_aircraft: f.aircraft,
    p_status: f.status,
    p_limit: UCUS_LIMIT,
  });
  const o = out[0] ?? {};
  return {
    ozet: o.ozet ?? { total: 0, realized: 0, canceled: 0, minutes: 0, students: 0 },
    matched: o.matched ?? 0,
    rows: o.rows ?? [],
  };
}

export type IptalKirilim = { name: string; total: number; canceled: number; studentId?: number };

export type IptalSatir = {
  id: number;
  date: string;
  studentId: number | null;
  student: string;
  instructor: string;
  aircraft: string;
  duty: string;
  cancelNote: string;
};

export type IptalSayfa = {
  ozet: { total: number; canceled: number; withNote: number };
  monthly: Array<{ month: string; total: number; canceled: number }>;
  byInstructor: IptalKirilim[];
  byAircraft: IptalKirilim[];
  byStudent: IptalKirilim[];
  matched: number;
  rows: IptalSatir[];
};

export async function getIptalSayfa(f: {
  from: string;
  to: string;
  q: string | null;
  onlyNote: boolean;
}): Promise<IptalSayfa> {
  const out = await rows<Partial<IptalSayfa>>("odt_iptal_sayfa", {
    p_from: f.from,
    p_to: f.to,
    p_q: f.q,
    p_only_note: f.onlyNote,
    p_limit: UCUS_LIMIT,
  });
  const o = out[0] ?? {};
  return {
    ozet: o.ozet ?? { total: 0, canceled: 0, withNote: 0 },
    monthly: o.monthly ?? [],
    byInstructor: o.byInstructor ?? [],
    byAircraft: o.byAircraft ?? [],
    byStudent: o.byStudent ?? [],
    matched: o.matched ?? 0,
    rows: o.rows ?? [],
  };
}

export type GecikenTaksit = {
  studentId: number;
  name: string;
  gsm: string;
  subject: string;
  installment: string;
  date: string;
  days: number;
  amount: number;
  symbol: string | null;
  shortcode: string | null;
};

export type GerideKalan = {
  studentId: number;
  name: string;
  gsm: string;
  due: number;
  paid: number;
  behind: number;
  since: string | null;
  days: number | null;
  symbol: string | null;
  shortcode: string | null;
};

export type AcikBakiye = {
  studentId: number;
  name: string;
  trainingStatus: string;
  price: number;
  payed: number;
  remaining: number;
  contracts: number;
  symbol: string | null;
  shortcode: string | null;
};

export type GecikenSayfa = { installments: GecikenTaksit[]; behind: GerideKalan[]; open: AcikBakiye[] };

export async function getGecikenSayfa(): Promise<GecikenSayfa> {
  const out = await rows<Partial<GecikenSayfa>>("odt_geciken_sayfa");
  const o = out[0] ?? {};
  return { installments: o.installments ?? [], behind: o.behind ?? [], open: o.open ?? [] };
}
