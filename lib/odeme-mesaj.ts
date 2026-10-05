import { rows } from "./db";
import { getCurrencyMap } from "./ogrenci";
import { overdueRemainingFromPlanAndPaid } from "./hesaplamalar";
import { toWhatsAppPhone } from "./wapi-phone";
import {
  ODEME_MESAJLARI,
  addDaysYmd,
  fmtGun,
  fmtTutar,
  isoToYmd,
  todayYmd,
  type OdemeAlan,
} from "./odeme-mesaj-tanim";

export {
  ODEME_MESAJLARI,
  ODEME_ALAN_ETIKET,
  desk360Parametreler,
  findDesk360Sablon,
  onizlemeDoldur,
} from "./odeme-mesaj-tanim";
export type { OdemeAlan, OdemeMesajTanimi } from "./odeme-mesaj-tanim";

type Inst = { id: number; ymd: string; price: number; currencyId: number; status: string };
type Pay = { ymd: string; amount: number; currencyId: number };

function looksPaid(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s.includes("paid") || s.includes("payed") || s.includes("ödend") || s.includes("odendi");
}

function kalanListe(insts: Inst[], pays: Pay[]): Array<Inst & { kalan: number }> {
  const byCur = new Map<number, Inst[]>();
  for (const i of insts) {
    const list = byCur.get(i.currencyId) ?? [];
    list.push(i);
    byCur.set(i.currencyId, list);
  }
  const payByCur = new Map<number, number>();
  for (const p of pays) {
    payByCur.set(p.currencyId, (payByCur.get(p.currencyId) ?? 0) + p.amount);
  }
  const out: Array<Inst & { kalan: number }> = [];
  for (const [, list] of byCur) {
    list.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.id - b.id);
    let havuz = payByCur.get(list[0]?.currencyId ?? 0) ?? 0;
    if (list[0]) havuz = payByCur.get(list[0].currencyId) ?? 0;
    for (const i of list) {
      if (looksPaid(i.status)) {
        out.push({ ...i, kalan: 0 });
        havuz = Math.max(0, havuz - i.price);
        continue;
      }
      const kullan = Math.min(havuz, i.price);
      havuz -= kullan;
      out.push({ ...i, kalan: Math.max(0, Math.round((i.price - kullan) * 100) / 100) });
    }
  }
  out.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.id - b.id);
  return out;
}

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export type OdemeOgrenciDoldur = {
  id: number;
  name: string;
  phone: string;
  phoneOk: boolean;
  not: string;
  values: Record<string, Record<OdemeAlan, string>>;
  uygun: Record<string, boolean>;
};

export async function getOdemeOgrenciDoldur(studentId: number): Promise<OdemeOgrenciDoldur | null> {
  const students = await rows<{ m_ID: unknown; firstName: string | null; lastName: string | null; gsm: string | null }>(
    "odt_odeme_student",
    { p_student_id: studentId }
  );
  const st = students[0];
  if (!st) return null;
  const id = n(st.m_ID);
  const name = `${st.firstName ?? ""} ${st.lastName ?? ""}`.replace(/\s+/g, " ").trim() || `#${id}`;
  const phone = toWhatsAppPhone(st.gsm ?? "") ?? "";
  const { symbolMap } = await getCurrencyMap();
  const today = todayYmd();

  // dt alanları fonksiyonlardan 'YYYY-MM-DD' metni olarak gelir.
  const args = { p_student_id: id };
  const instRows = await rows<Record<string, unknown>>("odt_odeme_installments", args);
  const payRows = await rows<Record<string, unknown>>("odt_odeme_payments", args);
  const dueRows = await rows<{ currencyID: unknown; sum_plan: unknown }>("odt_odeme_due", args);
  const paidRows = await rows<{ currencyID: unknown; sum_payed: unknown }>("odt_odeme_paid", args);

  const insts: Inst[] = instRows.map((r) => ({
    id: n(r.id),
    ymd: isoToYmd(String(r.dt ?? "")),
    price: n(r.price),
    currencyId: n(r.currencyId),
    status: String(r.status ?? ""),
  })).filter((i) => i.ymd);
  const pays: Pay[] = payRows.map((r) => ({
    ymd: isoToYmd(String(r.dt ?? "")),
    amount: n(r.amount),
    currencyId: n(r.currencyId),
  }));

  const kalan = kalanListe(insts, pays);
  const geciken = kalan.filter((i) => i.kalan > 0.009 && i.ymd < today);
  const gelecek = kalan.filter((i) => i.kalan > 0.009 && i.ymd >= today);
  const hedef7 = addDaysYmd(today, 7);
  const dun = addDaysYmd(today, -1);
  const bugunYazi = fmtGun(today);

  const hatirlat7 = kalan.find((i) => i.kalan > 0.009 && i.ymd === hedef7) ?? null;
  const hatirlat = hatirlat7 ?? gelecek[0] ?? null;
  const gecikmeSatir = kalan.find((i) => i.kalan > 0.009 && i.ymd === dun) ?? (geciken.length ? geciken[0] : null);

  const gecikmisListe = overdueRemainingFromPlanAndPaid(
    dueRows.map((r) => ({ currencyID: n(r.currencyID), sum_plan: n(r.sum_plan) })),
    paidRows.map((r) => ({ currencyID: n(r.currencyID), sum_payed: n(r.sum_payed) }))
  );
  const gecikmisToplamMetin = gecikmisListe
    .map((r) => fmtTutar(r.remaining, symbolMap[r.currencyID] ?? "€"))
    .join(" + ");
  const emptyAlan = (): Record<OdemeAlan, string> => ({
    ad_soyad: name,
    vade_tarihi: "",
    odeme_tutari: "",
    gecikmis_tutar: "",
    son_odeme_tarihi: "",
    yeni_odeme_plani: "",
  });

  const values: Record<string, Record<OdemeAlan, string>> = {};
  const uygun: Record<string, boolean> = {};

  for (const m of ODEME_MESAJLARI) {
    const v = emptyAlan();
    if (m.id === "hatirlatma") {
      uygun[m.id] = !!hatirlat7;
      if (hatirlat) {
        v.vade_tarihi = fmtGun(hatirlat.ymd);
        v.odeme_tutari = fmtTutar(hatirlat.kalan, symbolMap[hatirlat.currencyId] ?? "€");
      } else {
        v.vade_tarihi = bugunYazi;
      }
    } else if (m.id === "gecikme") {
      uygun[m.id] = !!(gecikmeSatir && gecikmeSatir.ymd === dun);
      v.vade_tarihi = bugunYazi;
      v.gecikmis_tutar = gecikmisToplamMetin;
    } else if (m.id === "birinci") {
      uygun[m.id] = geciken.length > 0 || !!gecikmisToplamMetin;
      v.gecikmis_tutar = gecikmisToplamMetin;
      v.son_odeme_tarihi = bugunYazi;
    } else if (m.id === "ikinci") {
      uygun[m.id] = geciken.length > 0 || !!gecikmisToplamMetin;
      v.gecikmis_tutar = gecikmisToplamMetin;
      v.son_odeme_tarihi = bugunYazi;
    } else if (m.id === "durdurma") {
      uygun[m.id] = geciken.length > 0 || !!gecikmisToplamMetin;
      v.gecikmis_tutar = gecikmisToplamMetin;
    } else if (m.id === "plan_onay") {
      uygun[m.id] = true;
    }
    values[m.id] = v;
  }

  let not = "";
  if (!phone) not = "Kayıtta cep yok";
  else if (!gecikmisToplamMetin && geciken.length === 0 && !hatirlat) not = "Bu öğrenci için doldurulacak açık taksit yok";

  return { id, name, phone, phoneOk: !!phone, not, values, uygun };
}

export type OtomatikAday = {
  studentId: number;
  mesajId: "hatirlatma" | "gecikme";
  name: string;
  phone: string;
  values: string[];
  vadeYmd: string;
};

export async function listOtomatikAdaylar(): Promise<OtomatikAday[]> {
  const today = todayYmd();
  const hedef7 = addDaysYmd(today, 7);
  const dun = addDaysYmd(today, -1);
  const idRows = await rows<{ studentID: unknown }>("odt_odeme_auto_student_ids", {
    p_ymd_a: hedef7,
    p_ymd_b: dun,
  });
  const aday: OtomatikAday[] = [];
  for (const r of idRows) {
    const sid = n(r.studentID);
    if (!sid) continue;
    const d = await getOdemeOgrenciDoldur(sid);
    if (!d?.phoneOk) continue;
    const h = ODEME_MESAJLARI.find((m) => m.id === "hatirlatma")!;
    const g = ODEME_MESAJLARI.find((m) => m.id === "gecikme")!;
    if (d.uygun.hatirlatma) {
      const v = d.values.hatirlatma;
      aday.push({
        studentId: sid,
        mesajId: "hatirlatma",
        name: d.name,
        phone: d.phone,
        values: h.fields.map((f) => v[f]),
        vadeYmd: hedef7,
      });
    }
    if (d.uygun.gecikme) {
      const v = d.values.gecikme;
      aday.push({
        studentId: sid,
        mesajId: "gecikme",
        name: d.name,
        phone: d.phone,
        values: g.fields.map((f) => v[f]),
        vadeYmd: dun,
      });
    }
  }
  return aday;
}
