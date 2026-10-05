const BASE = "https://public-api.desk360.com/v1";

export type Desk360Channel = {
  id: number;
  name: string;
  phone: string;
  status: string;
  active: boolean;
};

export type Desk360Template = {
  id: number;
  name: string;
  sendable: boolean;
  languageId: number | null;
  language: string;
  body: string;
  variables: string[];
};

export type Desk360Chat = {
  id: number;
  phone: string;
  name: string;
  lastMessageAt: string | null;
};

function token(): string {
  const t = process.env.DESK360_API_TOKEN?.trim();
  if (!t) throw new Error("Desk360 anahtarı yok");
  return t;
}

function errorMessage(data: unknown, fallback: string): string {
  if (!data) return fallback;
  if (typeof data === "string" && data.trim()) return data.slice(0, 400);
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    const err = o.error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
      const m = (err as { message?: unknown }).message;
      if (typeof m === "string") return m;
    }
    if (typeof o.message === "string") return o.message;
  }
  return fallback;
}

async function desk360(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(errorMessage(data, `Desk360 ${res.status}`));
  }
  return data;
}

function asArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: unknown[] }).data;
  }
  return [];
}

export function defaultIntegrationId(): number {
  const n = Number(process.env.DESK360_DEFAULT_INTEGRATION_ID ?? "2247");
  return n > 0 ? n : 2247;
}

export async function listChannels(): Promise<Desk360Channel[]> {
  const rows = asArray(await desk360("/integrations"));
  return rows
    .map((raw) => {
      const r = raw as {
        id?: number;
        display_name?: string | null;
        name?: string | null;
        phone_number?: string | null;
        status?: string | null;
      };
      const status = String(r.status ?? "");
      return {
        id: Number(r.id ?? 0),
        name: String(r.display_name || r.name || "Adsız hat").trim() || "Adsız hat",
        phone: String(r.phone_number ?? "").trim(),
        status,
        active: status.toLowerCase() === "activated",
      };
    })
    .filter((c) => c.id > 0);
}

function translationBody(t: {
  body?: string | null;
  preview?: { body?: string | null } | null;
}): string {
  const body = (t.body ?? "").trim();
  if (body) return body;
  return String(t.preview?.body ?? "").trim();
}

export async function listTemplates(integrationId: number): Promise<Desk360Template[]> {
  const rows = asArray(await desk360(`/integrations/${integrationId}/conversations/templates/?page=1`));
  return rows
    .map((raw) => {
      const r = raw as {
        id?: number;
        name?: string;
        sendable?: boolean;
        translations?: Array<{
          language_id?: number;
          language?: string;
          body?: string | null;
          status?: string;
          variables?: string[];
          preview?: { body?: string | null } | null;
        }>;
      };
      const trs = r.translations ?? [];
      const active = trs.find((t) => String(t.status ?? "").includes("active")) ?? trs[0];
      const variables = (active?.variables ?? []).filter(Boolean);
      return {
        id: Number(r.id ?? 0),
        name: String(r.name ?? ""),
        sendable: !!r.sendable,
        languageId: active?.language_id ?? null,
        language: String(active?.language ?? ""),
        body: active ? translationBody(active) : "",
        variables,
      };
    })
    .filter((t) => t.id > 0);
}

export async function listChats(integrationId: number): Promise<Desk360Chat[]> {
  const rows = asArray(await desk360(`/integrations/${integrationId}/chats?page=1`));
  return rows
    .map((raw) => {
      const r = raw as {
        id?: number;
        phone?: string | null;
        name?: string | null;
        last_message_at?: string | null;
      };
      return {
        id: Number(r.id ?? 0),
        phone: String(r.phone ?? ""),
        name: String(r.name ?? ""),
        lastMessageAt: r.last_message_at ?? null,
      };
    })
    .filter((c) => c.id > 0);
}

export async function sendText(integrationId: number, to: string, text: string): Promise<{ messageId: string }> {
  const fd = new FormData();
  fd.set("to", to);
  fd.set("text", text);
  const data = await desk360(`/integrations/${integrationId}/conversations/messages`, {
    method: "POST",
    body: fd,
  });
  const id = data && typeof data === "object" ? String((data as { message_id?: unknown }).message_id ?? "") : "";
  return { messageId: id };
}

export async function sendTemplate(opts: {
  integrationId: number;
  templateId: number;
  languageId: number;
  phone: string;
  parameters?: Record<string, string>;
}): Promise<{ messageId: string }> {
  const fd = new FormData();
  fd.set("template_id", String(opts.templateId));
  fd.set("language_id", String(opts.languageId));
  fd.set("destinations[0][phone]", opts.phone);
  for (const [k, v] of Object.entries(opts.parameters ?? {})) {
    fd.set(`destinations[0][parameters][${k}]`, v);
  }
  const data = await desk360(`/integrations/${opts.integrationId}/conversations/templates/send`, {
    method: "POST",
    body: fd,
  });
  const id = data && typeof data === "object" ? String((data as { message_id?: unknown }).message_id ?? "") : "";
  return { messageId: id };
}
