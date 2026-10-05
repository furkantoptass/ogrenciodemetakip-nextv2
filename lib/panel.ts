import { rows } from "./db";

export type PanelPara = {
  currencyId: number | null;
  shortcode: string | null;
  symbol: string | null;
  price: number;
  payed: number;
  contracts: number;
};

export type PanelGeciken = {
  currencyId: number | null;
  shortcode: string | null;
  symbol: string | null;
  amount: number;
  installments: number;
  students: number;
};

export type PanelTaksit = {
  studentId: number;
  name: string;
  date: string;
  amount: number;
  symbol: string | null;
  shortcode: string | null;
};

export type PanelUcus = {
  date: string;
  student: string;
  duty: string;
  aircraft: string;
  instructor: string;
  minutes: number;
};

export type PanelOzet = {
  students: { total: number; active: number; graduated: number; paused: number; suspended: number };
  money: PanelPara[];
  overdue: PanelGeciken[];
  overdueList: PanelTaksit[];
  upcoming: PanelTaksit[];
  flights30: { count: number; minutes: number };
  flightsMonthly: Array<{ month: string; count: number; minutes: number }>;
  recentFlights: PanelUcus[];
  trainings: Array<{ name: string; count: number }>;
  lastSync: string | null;
};

const BOS: PanelOzet = {
  students: { total: 0, active: 0, graduated: 0, paused: 0, suspended: 0 },
  money: [],
  overdue: [],
  overdueList: [],
  upcoming: [],
  flights30: { count: 0, minutes: 0 },
  flightsMonthly: [],
  recentFlights: [],
  trainings: [],
  lastSync: null,
};

export async function getPanelOzet(): Promise<PanelOzet> {
  const out = await rows<Partial<PanelOzet>>("odt_panel_ozet");
  return { ...BOS, ...(out[0] ?? {}) };
}
