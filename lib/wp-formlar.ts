import { rows as qry, run } from "./db";
import { wpGet, type WpEntry, type WpFormPost } from "./wp";

export type FormSatir = {
  formId: number;
  title: string;
  active: boolean;
  labels: Record<string, string>;
};

export type KayitSatir = {
  entryId: number;
  formId: number;
  formTitle: string;
  date: string;
  ad: string;
  telefon: string;
  eposta: string;
  ozet: string;
  fields: Record<string, string>;
};

function n(v: unknown): number {
  return typeof v === "bigint" ? Number(v) : Number(v);
}

function parseLabels(content: string | undefined): Record<string, string> {
  if (!content) return {};
  try {
    const j = JSON.parse(content) as { fields?: Record<string, { label?: string }> };
    const out: Record<string, string> = {};
    for (const [id, f] of Object.entries(j.fields ?? {})) {
      if (f?.label) out[id] = String(f.label);
    }
    return out;
  } catch {
    return {};
  }
}

function parseTypes(content: string | undefined): Record<string, string> {
  if (!content) return {};
  try {
    const j = JSON.parse(content) as { fields?: Record<string, { type?: string }> };
    const out: Record<string, string> = {};
    for (const [id, f] of Object.entries(j.fields ?? {})) {
      if (f?.type) out[id] = String(f.type);
    }
    return out;
  } catch {
    return {};
  }
}

function pickKutular(
  fields: Record<string, string>,
  labels: Record<string, string>,
  types: Record<string, string>
): { ad: string; telefon: string; eposta: string; ozet: string } {
  let ad = "";
  let telefon = "";
  let eposta = "";
  let ozet = "";
  for (const [id, raw] of Object.entries(fields)) {
    const val = String(raw ?? "").trim();
    if (!val) continue;
    const t = (types[id] || "").toLowerCase();
    const lab = (labels[id] || "").toLowerCase();
    if (!ad && (t === "name" || /ad|soyad|isim|name/.test(lab))) ad = val.replace(/\s+/g, " ");
    if (!eposta && (t === "email" || lab.includes("e-posta") || lab.includes("eposta") || lab.includes("email") || val.includes("@"))) {
      eposta = val;
    }
    if (!telefon && (t === "phone" || /telefon|gsm|cep|phone|tel/.test(lab))) telefon = val;
    if (!ozet && (t === "textarea" || /mesaj|not|açıklama|aciklama|message|talep/.test(lab))) {
      ozet = val.replace(/\s+/g, " ").slice(0, 180);
    }
  }
  if (!ad) {
    const first = Object.values(fields).find((v) => String(v).trim() && !String(v).includes("@") && !String(v).startsWith("http"));
    ad = first ? String(first).replace(/\s+/g, " ").slice(0, 120) : "";
  }
  if (!telefon) {
    const tel = Object.values(fields).find((v) => {
      const d = String(v).replace(/\D/g, "");
      return d.length >= 10 && d.length <= 15 && !String(v).includes("@");
    });
    if (tel) telefon = String(tel);
  }
  return { ad, telefon, eposta, ozet };
}

export async function listForms(): Promise<FormSatir[]> {
  const rows = await qry<{
    form_id: unknown;
    title: string;
    field_labels: string | null;
    active: unknown;
    active_manual: unknown;
    auto_active: unknown;
  }>("odt_form_list");
  return rows.map((r) => {
    let labels: Record<string, string> = {};
    try {
      labels = r.field_labels ? (JSON.parse(r.field_labels) as Record<string, string>) : {};
    } catch {
      labels = {};
    }
    const manual = r.active_manual === true;
    const active = manual ? r.active === true : r.auto_active === true;
    return { formId: n(r.form_id), title: r.title, active, labels };
  });
}

export async function setFormActive(formId: number, active: boolean): Promise<void> {
  const autoRows = await qry<{ auto_active: unknown }>("odt_form_auto_active", { p_form_id: formId });
  const auto = autoRows[0]?.auto_active === true;
  const manual = active !== auto;
  await run("odt_form_set_active", { p_form_id: formId, p_active: active, p_active_manual: manual });
}

export async function syncFormsFromWp(): Promise<number> {
  const forms = await wpGet<WpFormPost[]>("/wpforms/v1/forms");
  let nForms = 0;
  // Ayni form_id tekrar ederse son satir gecerli olur (eskiden sirayla yaziliyordu)
  const uniq = new Map<number, { form_id: number; title: string; field_labels: string; field_types: string }>();
  for (const f of forms) {
    const id = n(f.ID ?? f.id);
    if (!id) continue;
    const title = String(f.post_title || f.title || `Form ${id}`).slice(0, 190);
    const labels = parseLabels(f.post_content);
    const types = parseTypes(f.post_content);
    uniq.set(id, {
      form_id: id,
      title,
      field_labels: JSON.stringify(labels),
      field_types: JSON.stringify(types),
    });
    nForms += 1;
  }
  if (uniq.size > 0) await run("odt_form_upsert", { p_rows: [...uniq.values()] });
  return nForms;
}

export async function syncEntriesPage(page: number): Promise<{ n: number; bitti: boolean }> {
  const forms = await qry<{ form_id: unknown; field_labels: string | null; field_types: string | null }>(
    "odt_form_fields"
  );
  const labelMap: Record<number, Record<string, string>> = {};
  const typeMap: Record<number, Record<string, string>> = {};
  for (const r of forms) {
    const id = n(r.form_id);
    try {
      labelMap[id] = r.field_labels ? (JSON.parse(r.field_labels) as Record<string, string>) : {};
    } catch {
      labelMap[id] = {};
    }
    try {
      typeMap[id] = r.field_types ? (JSON.parse(r.field_types) as Record<string, string>) : {};
    } catch {
      typeMap[id] = {};
    }
  }

  const entries = await wpGet<WpEntry[]>(`/northfly/v1/entries?per_page=100&page=${page}`);
  if (!Array.isArray(entries) || entries.length === 0) return { n: 0, bitti: true };

  const rows: Array<{
    entryId: number;
    formId: number;
    date: string | null;
    status: string;
    fieldsJson: string;
    ad: string;
    telefon: string;
    eposta: string;
    ozet: string;
  }> = [];
  for (const e of entries) {
    const entryId = n(e.entry_id);
    const formId = n(e.form_id);
    if (!entryId || !formId) continue;
    const fields = (e.fields ?? {}) as Record<string, string>;
    const picked = pickKutular(fields, labelMap[formId] ?? {}, typeMap[formId] ?? {});
    const date = e.date && /^\d{4}-\d{2}-\d{2}/.test(e.date) ? e.date : null;
    rows.push({
      entryId,
      formId,
      date,
      status: e.status || "",
      fieldsJson: JSON.stringify(fields),
      ad: picked.ad.slice(0, 190),
      telefon: picked.telefon.slice(0, 80),
      eposta: picked.eposta.slice(0, 190),
      ozet: picked.ozet.slice(0, 220),
    });
  }
  if (rows.length > 0) {
    // ON CONFLICT DO UPDATE ayni ifadede tekrar eden entry_id'yi kabul etmez (MySQL son satiri alirdi)
    const uniq = [...new Map(rows.map((r) => [r.entryId, r])).values()];
    await run("odt_form_entries_upsert", {
      p_rows: uniq.map((r) => ({
        entry_id: r.entryId,
        form_id: r.formId,
        entry_date: r.date,
        status: r.status.slice(0, 40),
        fields_json: r.fieldsJson,
        ad: r.ad,
        telefon: r.telefon,
        eposta: r.eposta,
        ozet: r.ozet,
      })),
    });
  }
  return { n: entries.length, bitti: entries.length < 100 };
}

export async function listKayitlar(opts: {
  q?: string;
  formId?: number;
}): Promise<{ forms: FormSatir[]; kayitlar: KayitSatir[]; kapali: number }> {
  const forms = await listForms();
  const acik = forms.filter((f) => f.active).map((f) => f.formId);
  const titleBy = Object.fromEntries(forms.map((f) => [f.formId, f.title]));
  if (acik.length === 0) return { forms, kayitlar: [], kapali: forms.length };

  const q = (opts.q ?? "").trim().slice(0, 40).replace(/[%_\\]/g, "");
  const rows = await qry<{
    entry_id: unknown;
    form_id: unknown;
    entry_date: Date | string | null;
    ad: string | null;
    telefon: string | null;
    eposta: string | null;
    ozet: string | null;
    fields_json: string | null;
  }>("odt_form_entries_list", {
    p_form_ids: acik,
    p_form_id: opts.formId && acik.includes(opts.formId) ? opts.formId : null,
    p_search: q.length >= 2 ? q : null,
  });

  const kayitlar: KayitSatir[] = rows.map((r) => {
    const formId = n(r.form_id);
    let fields: Record<string, string> = {};
    try {
      fields = r.fields_json ? (JSON.parse(r.fields_json) as Record<string, string>) : {};
    } catch {
      fields = {};
    }
    const dt = r.entry_date instanceof Date ? r.entry_date.toISOString() : String(r.entry_date ?? "");
    return {
      entryId: n(r.entry_id),
      formId,
      formTitle: titleBy[formId] || `Form ${formId}`,
      date: dt,
      ad: r.ad ?? "",
      telefon: r.telefon ?? "",
      eposta: r.eposta ?? "",
      ozet: r.ozet ?? "",
      fields,
    };
  });
  return { forms, kayitlar, kapali: forms.filter((f) => !f.active).length };
}
