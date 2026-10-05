import { rows } from "./db";
import { extraBilledEur, fmtMinutes, fmtTrDate } from "./hesaplamalar";

export type DetayInstallment = {
  contractId: number;
  subject: string;
  date: string;
  name: string;
  price: number;
  currencyId: number;
  status: string;
  note: string;
};

export type DetayPayment = {
  contractId: number;
  subject: string;
  date: string;
  amount: number;
  currencyId: number;
  note: string;
  creator: string;
};

export type DetayNote = {
  id: number;
  body: string;
  createdAt: string;
  authorName: string;
};

export type DetayFlight = {
  date: string;
  duty: string;
  aircraft: string;
  route: string;
  minutes: number;
  instructor: string;
  extra: boolean;
  control: boolean;
};

export type DetayPdf = {
  subject: string;
  signDate: string;
  fileName: string;
  url: string;
};

export type DetayRating = {
  id: "cpl" | "ir" | "me" | "atpl";
  label: string;
  plan: number;
  flown: number;
  school: string;
};

export type OgrenciDetayData = {
  installments: DetayInstallment[];
  payments: DetayPayment[];
  notes: DetayNote[];
  flights: DetayFlight[];
  pdfs: DetayPdf[];
  extraMinutes: number;
  extraBill: number | null;
};

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function s(v: unknown): string {
  return v == null ? "" : String(v);
}

function isoDate(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function isControl(v: unknown): boolean {
  const t = s(v).trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes";
}

function fileNameFromPath(path: string, url: string): string {
  const p = path.replace(/\\/g, "/");
  const fromPath = p.split("/").pop() ?? "";
  if (fromPath) return decodeURIComponent(fromPath);
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.split("/").pop() ?? "sözleşme.pdf");
  } catch {
    return "sözleşme.pdf";
  }
}

export async function getOgrenciDetay(studentId: number): Promise<OgrenciDetayData> {
  const args = { p_student_id: studentId };
  const [instRows, payRows, noteRows, flightRows, pdfRows, extraRows] = await Promise.all([
    rows("odt_detay_installments", args),
    rows("odt_detay_payments", args),
    rows("odt_detay_notes", args),
    rows("odt_detay_flights", args),
    rows("odt_detay_pdfs", args),
    rows("odt_detay_extra_minutes", args),
  ]);

  const extraMinutes = n(extraRows[0]?.minutes);
  return {
    extraMinutes,
    extraBill: extraBilledEur(extraMinutes),
    installments: instRows.map((r) => ({
      contractId: n(r.contractId),
      subject: s(r.subject),
      date: isoDate(r.dt),
      name: s(r.name),
      price: n(r.price),
      currencyId: n(r.currencyId),
      status: s(r.status),
      note: s(r.note).replace(/<[^>]+>/g, ""),
    })),
    payments: payRows.map((r) => ({
      contractId: n(r.contractId),
      subject: s(r.subject),
      date: isoDate(r.dt),
      amount: n(r.amount),
      currencyId: n(r.currencyId),
      note: s(r.note).replace(/<[^>]+>/g, ""),
      creator: s(r.creator),
    })),
    notes: noteRows.map((r) => ({
      id: n(r.id),
      body: s(r.body),
      createdAt: isoDate(r.createdAt),
      authorName: s(r.authorName),
    })),
    flights: flightRows.map((r) => ({
      date: isoDate(r.dt),
      duty: s(r.duty),
      aircraft: s(r.aircraft),
      route: s(r.route),
      minutes: n(r.minutes),
      instructor: s(r.instructor).replace(/^[A-Z]{2,4}\s*-\s*/, ""),
      extra: isControl(r.paidFlight) || s(r.paidFlight) === "1",
      control: isControl(r.control),
    })),
    pdfs: pdfRows.map((r) => ({
      subject: s(r.subject),
      signDate: isoDate(r.signDate),
      fileName: fileNameFromPath(s(r.storagePath), s(r.url)),
      url: s(r.url),
    })),
  };
}
