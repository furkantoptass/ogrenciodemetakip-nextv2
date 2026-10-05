import { fmtMoneyEu } from "./hesaplamalar";

export type OdemeAlan = "ad_soyad" | "vade_tarihi" | "odeme_tutari" | "gecikmis_tutar" | "son_odeme_tarihi" | "yeni_odeme_plani";

export type OdemeMesajTanimi = {
  id: string;
  templateName: string;
  aliases?: string[];
  title: string;
  when: string;
  fields: OdemeAlan[];
  body: string;
};

export function findDesk360Sablon<T extends { name: string }>(templates: T[], tanim: OdemeMesajTanimi): T | undefined {
  const names = [tanim.templateName, ...(tanim.aliases ?? [])].map((s) => s.toLowerCase());
  return templates.find((t) => names.includes(t.name.toLowerCase()));
}

export const ODEME_ALAN_ETIKET: Record<OdemeAlan, string> = {
  ad_soyad: "Ad soyad",
  vade_tarihi: "Vade tarihi",
  odeme_tutari: "Ödenecek tutar",
  gecikmis_tutar: "Gecikmiş tutar",
  son_odeme_tarihi: "Son ödeme tarihi",
  yeni_odeme_plani: "Yeni ödeme planı",
};

export const ODEME_MESAJLARI: OdemeMesajTanimi[] = [
  {
    id: "hatirlatma",
    templateName: "northfly_odeme_hatirlatma",
    aliases: ["finansodeme"],
    title: "Ödeme hatırlatma",
    when: "Vadeden 7 gün önce",
    fields: ["ad_soyad", "vade_tarihi", "odeme_tutari"],
    body: `Merhaba {{1}}, NorthFLY eğitim ödeme planınız kapsamında {{2}} tarihinde ödenmesi gereken tutar {{3}} olarak görünmektedir.

Ödemenizi yaptıysanız bu mesajı dikkate almayınız. Sorularınız için bu mesaja yanıt verebilirsiniz.

NorthFLY Finans`,
  },
  {
    id: "gecikme",
    templateName: "northfly_odeme_gecikme",
    title: "Gecikmiş ödeme",
    when: "Vadenin ertesi günü",
    fields: ["ad_soyad", "vade_tarihi", "gecikmis_tutar"],
    body: `Merhaba {{1}}, NorthFLY eğitim ödeme planınızdaki {{2}} vadeli ödemenizden kalan {{3}} tutarındaki bakiye gecikmiş görünmektedir.

Ödemenizi yapmanızı rica ederiz. Ödeme yaptıysanız kontrol edebilmemiz için dekontunuzu bu mesaja yanıt olarak paylaşabilirsiniz.

NorthFLY Finans`,
  },
  {
    id: "birinci",
    templateName: "northfly_odeme_birinci_uyari",
    title: "Birinci uyarı",
    when: "7 gün süre",
    fields: ["ad_soyad", "gecikmis_tutar", "son_odeme_tarihi"],
    body: `Merhaba {{1}}, eğitim ödeme planınız kapsamındaki gecikmiş kalan borcunuz {{2}} tutarındadır.

Ödemenizi 7 gün içinde, en geç {{3}} tarihine kadar tamamlamanızı rica ederiz. Ödeme yaptıysanız dekontunuzu, ödeme planıyla ilgili talebiniz varsa talebinizi bu mesaja yanıt olarak iletebilirsiniz.

NorthFLY Finans`,
  },
  {
    id: "ikinci",
    templateName: "northfly_odeme_ikinci_uyari",
    title: "İkinci uyarı",
    when: "3 gün süre",
    fields: ["ad_soyad", "gecikmis_tutar", "son_odeme_tarihi"],
    body: `Merhaba {{1}}, önceki ödeme bildirimimize ilişkin gecikmiş kalan borcunuz {{2}} tutarındadır.

Ödemenizi 3 gün içinde, en geç {{3}} tarihine kadar tamamlamanızı rica ederiz. Bu süre içinde ödeme yapılmaması durumunda uçuş planlamanız durdurulacaktır.

Ödeme yaptıysanız dekontunuzu bu mesaja yanıt olarak paylaşabilirsiniz.

NorthFLY Finans`,
  },
  {
    id: "durdurma",
    templateName: "northfly_ucus_planlama_durdurma",
    title: "Uçuş planlaması durduruldu",
    when: "Planlama durduktan sonra",
    fields: ["ad_soyad", "gecikmis_tutar"],
    body: `Merhaba {{1}}, eğitim ödeme planınız kapsamındaki {{2}} tutarındaki gecikmiş kalan borcunuz nedeniyle uçuş planlamanız durdurulmuştur.

Ödeme durumunun netleştirilmesi ve uçuş planlamanızın yeniden başlatılmasının değerlendirilmesi için finans birimimizle bu mesaj üzerinden iletişime geçmenizi rica ederiz.

NorthFLY Finans`,
  },
  {
    id: "plan_onay",
    templateName: "northfly_odeme_plani_onay",
    title: "Revize ödeme planı",
    when: "Yeni plan onayı",
    fields: ["ad_soyad", "yeni_odeme_plani"],
    body: `Merhaba {{1}}, görüşmemiz doğrultusunda onayınıza sunulan yeni ödeme planınız şöyledir:

{{2}}

Bu ödeme planını kabul ediyorsanız bu mesaja “Ödeme planını onaylıyorum” şeklinde yanıt vermenizi rica ederiz.

NorthFLY Finans`,
  },
];

export function todayYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function fmtGun(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ymd;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function isoToYmd(iso: string): string {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

export function fmtTutar(n: number, symbol: string): string {
  const s = (symbol || "€").trim() || "€";
  return `${fmtMoneyEu(n)}${s}`;
}

export function onizlemeDoldur(body: string, values: string[]): string {
  let out = body;
  values.forEach((v, i) => {
    out = out.split(`{{${i + 1}}}`).join(v || `{{${i + 1}}}`);
  });
  return out;
}

export function desk360Parametreler(variableKeys: string[], values: string[]): Record<string, string> {
  const keys = variableKeys.length > 0 ? variableKeys : values.map((_, i) => String(i + 1));
  const out: Record<string, string> = {};
  keys.forEach((k, i) => {
    out[k] = values[i] ?? "";
  });
  return out;
}
