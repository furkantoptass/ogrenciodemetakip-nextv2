import { rows as dbRows, run } from "./db";

export type WapiSendRow = {
  id: number;
  createdAt: string;
  authorEmail: string;
  integrationId: number;
  phone: string;
  kind: string;
  body: string;
  templateName: string;
  ok: boolean;
  errorText: string;
  messageId: string;
};

export async function logWapiSend(row: {
  authorEmail: string;
  integrationId: number;
  phone: string;
  kind: string;
  body: string;
  templateName?: string;
  ok: boolean;
  errorText?: string;
  messageId?: string;
}): Promise<void> {
  try {
    await run("odt_wapi_send_log", {
      p_author_email: row.authorEmail,
      p_integration_id: row.integrationId,
      p_phone: row.phone,
      p_kind: row.kind,
      p_body: row.body || null,
      p_template_name: row.templateName || null,
      p_ok: row.ok,
      p_error_text: row.errorText ? row.errorText.slice(0, 500) : null,
      p_message_id: row.messageId || null,
    });
  } catch {
    // Geçmiş yazılamasa gönderim yine yapılır.
  }
}

export async function listWapiSends(integrationId: number): Promise<WapiSendRow[]> {
  try {
    const rows = await dbRows<{
      id: number;
      created_at: Date | string;
      author_email: string;
      integration_id: number;
      phone: string;
      kind: string;
      body: string | null;
      template_name: string | null;
      ok: unknown;
      error_text: string | null;
      message_id: string | null;
    }>("odt_wapi_sends", { p_integration_id: integrationId });
    return rows.map((r) => ({
      id: Number(r.id),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      authorEmail: r.author_email,
      integrationId: Number(r.integration_id),
      phone: r.phone,
      kind: r.kind,
      body: r.body ?? "",
      templateName: r.template_name ?? "",
      ok: r.ok === true || Number(r.ok) === 1,
      errorText: r.error_text ?? "",
      messageId: r.message_id ?? "",
    }));
  } catch {
    return [];
  }
}

export async function wapiAlreadySent(templateName: string, phone: string, needle: string): Promise<boolean> {
  try {
    const rows = await dbRows<{ id: unknown }>("odt_wapi_already_sent", {
      p_template_name: templateName,
      p_phone: phone,
      p_like: `%${needle}%`,
    });
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function ensureAutoTable() {
  await run("odt_wapi_auto_ensure");
}

export async function getWapiAuto(): Promise<{ enabled: boolean; lastRun: string | null }> {
  try {
    await ensureAutoTable();
    const rows = await dbRows<{ enabled: unknown; last_run: Date | string | null }>("odt_wapi_auto_get");
    const r = rows[0];
    return {
      enabled: r?.enabled === true || Number(r?.enabled) === 1,
      lastRun: r?.last_run ? (r.last_run instanceof Date ? r.last_run.toISOString() : String(r.last_run)) : null,
    };
  } catch {
    return { enabled: false, lastRun: null };
  }
}

export async function setWapiAutoEnabled(enabled: boolean): Promise<void> {
  await ensureAutoTable();
  await run("odt_wapi_auto_set", { p_enabled: enabled });
}

export async function touchWapiAutoRun(): Promise<void> {
  await ensureAutoTable();
  await run("odt_wapi_auto_touch");
}
