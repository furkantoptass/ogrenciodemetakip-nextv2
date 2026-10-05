import { rows as dbRows, run } from "./db";

/**
 * Naeron REST BI v2 → Supabase eşitlemesi (https://naeron.com/docs/restBI/).
 * Her tablo `bi_<ad>` uç noktasından sayfa sayfa okunur ve `odt_naeron_upsert_<ad>` ile m_ID üzerinden upsert edilir.
 */
const BASE = (process.env.NAERON_API_BASE || "https://api.naeron.com:3110/v2").replace(/\/+$/, "");

// Sıra: önce referans tabloları, en son en büyük tablo (uçuşlar).
const TABLES = [
  { name: "currencies", incremental: false },
  { name: "facilities", incremental: true },
  { name: "corporate_labels", incremental: true },
  { name: "fleets", incremental: true },
  { name: "aircrafts_simulators", incremental: true },
  { name: "trainings", incremental: true },
  { name: "groups", incremental: true },
  { name: "employees", incremental: true },
  { name: "students", incremental: true },
  { name: "student_contracts", incremental: true },
  { name: "student_installments", incremental: true },
  { name: "student_payments", incremental: true },
  { name: "student_trainings", incremental: true },
  { name: "student_certificates", incremental: false },
  { name: "flights", incremental: true },
] as const;

export type NaeronTable = (typeof TABLES)[number]["name"];
export const NAERON_TABLES: NaeronTable[] = TABLES.map((t) => t.name);

export type NaeronTableResult = {
  table: NaeronTable;
  ok: boolean;
  mode: "snapshot" | "changes";
  fetched: number;
  written: number;
  deleted: number;
  error?: string;
};

type Page = { data?: unknown[]; meta?: { cursor?: string; hasMore?: boolean; serverTime?: string }; error?: { message?: string } };
type DeletedPage = { deletedRecords?: Array<{ recordID?: unknown }>; meta?: { cursor?: string; hasMore?: boolean } };

const PAGE_LIMIT = 2000;
const WRITE_CHUNK = 500;
// Postgres'te küçük harfe çevrilen sütunlar (uçuşlar).
const LOWER_KEYS: Record<string, string> = { RT: "rt", IFR: "ifr", SPIC: "spic", MCC: "mcc" };

function apiKey(): string {
  const key = (process.env.NAERON_API_KEY || "").trim();
  if (!key) throw new Error("NAERON_API_KEY tanımlı değil.");
  return key;
}

async function naeronGet<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "x-api-key": apiKey() }, cache: "no-store" });
  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok || !body) {
    throw new Error(body?.error?.message || `Naeron HTTP ${res.status}`);
  }
  return body;
}

function normalizeRow(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    // Postgres metni \u0000 kabul etmez.
    out[LOWER_KEYS[k] ?? k] = typeof v === "string" ? v.replace(/\u0000/g, "") : v;
  }
  return out.m_ID == null ? null : out;
}

async function writeRows(table: NaeronTable, list: Record<string, unknown>[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < list.length; i += WRITE_CHUNK) {
    written += await run(`odt_naeron_upsert_${table}`, { p_rows: list.slice(i, i + WRITE_CHUNK) });
  }
  return written;
}

async function syncFlightDeletes(since: string): Promise<number> {
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const page = await naeronGet<DeletedPage>("/tables/bi_flights/deleted", {
      limit: String(PAGE_LIMIT),
      sinceDate: since,
      cursor,
    });
    const ids = (page.deletedRecords ?? []).map((r) => Number(r.recordID)).filter((n) => Number.isInteger(n));
    if (ids.length) deleted += await run("odt_naeron_flights_delete", { p_ids: ids });
    cursor = page.meta?.hasMore ? page.meta.cursor : undefined;
  } while (cursor);
  return deleted;
}

async function syncTable(
  table: NaeronTable,
  incremental: boolean,
  since: string | null
): Promise<NaeronTableResult> {
  const mode: "snapshot" | "changes" = incremental && since ? "changes" : "snapshot";
  const result: NaeronTableResult = { table, ok: false, mode, fetched: 0, written: 0, deleted: 0 };
  let serverTime: string | null = null;
  try {
    let cursor: string | undefined;
    do {
      const page = await naeronGet<Page>(`/tables/bi_${table}/${mode}`, {
        limit: String(PAGE_LIMIT),
        sinceDate: mode === "changes" ? since ?? undefined : undefined,
        cursor,
      });
      // İlk sayfanın sunucu saati bir sonraki artımlı eşitlemenin başlangıcıdır.
      if (!serverTime && page.meta?.serverTime) serverTime = page.meta.serverTime;
      const list = (page.data ?? []).map(normalizeRow).filter((r): r is Record<string, unknown> => r !== null);
      result.fetched += list.length;
      result.written += await writeRows(table, list);
      cursor = page.meta?.hasMore ? page.meta.cursor : undefined;
    } while (cursor);
    if (table === "flights" && mode === "changes" && since) {
      result.deleted = await syncFlightDeletes(since);
    }
    result.ok = true;
    await run("odt_naeron_state_set", {
      p_table: table,
      p_server_time: serverTime,
      p_rows: result.written,
      p_ok: true,
      p_error: null,
    });
  } catch (e) {
    result.error = e instanceof Error ? e.message : "Eşitlenemedi";
    await run("odt_naeron_state_set", {
      p_table: table,
      p_server_time: null,
      p_rows: result.written,
      p_ok: false,
      p_error: result.error,
    }).catch(() => undefined);
  }
  return result;
}

/**
 * `full: true` her tabloyu baştan çeker; aksi halde önceki başarılı eşitlemeden beri değişenleri alır
 * (ilk çalıştırmada ya da artımlı desteklemeyen tablolarda yine tam çekim yapılır).
 */
export async function syncNaeron(opts: { full?: boolean; tables?: string[] } = {}): Promise<{
  ok: boolean;
  results: NaeronTableResult[];
}> {
  apiKey();
  const state = await dbRows<{ table_name: string; last_server_time: Date | string | null; ok: boolean }>(
    "odt_naeron_state_list"
  );
  const sinceByTable = new Map<string, string>();
  for (const s of state) {
    if (!s.last_server_time) continue;
    const d = s.last_server_time instanceof Date ? s.last_server_time : new Date(`${s.last_server_time}Z`);
    if (!Number.isNaN(d.getTime())) sinceByTable.set(s.table_name, d.toISOString());
  }
  const wanted = opts.tables?.length ? TABLES.filter((t) => opts.tables!.includes(t.name)) : TABLES;
  const results: NaeronTableResult[] = [];
  for (const t of wanted) {
    const since = opts.full ? null : sinceByTable.get(t.name) ?? null;
    results.push(await syncTable(t.name, t.incremental, since));
  }
  return { ok: results.every((r) => r.ok), results };
}

export async function naeronSyncState() {
  return dbRows<{
    table_name: string;
    last_server_time: Date | string | null;
    last_run_at: Date | string;
    row_count: number;
    ok: boolean;
    error_text: string | null;
  }>("odt_naeron_state_list");
}
