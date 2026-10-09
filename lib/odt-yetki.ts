import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { rows as dbRows, run } from "@/lib/db";
import { ODT_NAV_ITEMS } from "@/lib/odt-nav";
import { type OkulId, secilenOkullar, temizOkullar } from "@/lib/okul";

export const ODT_SUPER_EMAIL = normEmail(process.env.ODT_SUPER_EMAIL || "ulukan@northfly.aero");

export const ODT_PAGE_MODULES = ODT_NAV_ITEMS.filter((i) => i.id !== "super").map((i) => ({
  id: i.id,
  label: i.label,
}));

export type OdtYetki = {
  id: number;
  email: string;
  name: string;
  active: boolean;
  isSuper: boolean;
  modules: string[];
  okullar: OkulId[];
};

type UserRow = {
  id: unknown;
  email: string;
  full_name: string;
  is_active: unknown;
  is_super: unknown;
};

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

function allowedDomains(): string[] {
  const raw = process.env.ODT_ALLOWED_EMAIL_DOMAINS || "northfly.aero";
  return raw
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

function allowedEmails(): string[] {
  const raw = process.env.ODT_ALLOWED_EMAILS || "";
  return raw
    .split(",")
    .map((email) => normEmail(email))
    .filter(Boolean);
}

function isAllowedEmail(email: string): boolean {
  const e = normEmail(email);
  if (allowedEmails().includes(e)) return true;
  return allowedDomains().some((domain) => e.endsWith(`@${domain}`));
}

function asId(v: unknown): number {
  return typeof v === "bigint" ? Number(v) : Number(v);
}

function asOn(v: unknown): boolean {
  return v === true || v === 1 || v === "1";
}

let ready = false;

async function ensureSchema(): Promise<void> {
  if (ready) return;
  const allModules = ODT_PAGE_MODULES.map((m) => m.id);
  const existing = await dbRows<UserRow>("odt_yetki_user_by_email", { p_email: ODT_SUPER_EMAIL });
  if (!existing[0]) {
    await run("odt_yetki_super_insert", { p_email: ODT_SUPER_EMAIL });
    const created = await dbRows<UserRow>("odt_yetki_user_by_email", { p_email: ODT_SUPER_EMAIL });
    const uid = asId(created[0]?.id);
    if (uid) {
      await run("odt_yetki_modules_add", { p_user_id: uid, p_module_ids: allModules });
    }
  } else {
    await run("odt_yetki_super_fix", { p_email: ODT_SUPER_EMAIL });
  }
  const supers = await dbRows<{ id: unknown }>("odt_yetki_super_ids");
  for (const row of supers) {
    const uid = asId(row.id);
    if (!uid) continue;
    await run("odt_yetki_modules_add", { p_user_id: uid, p_module_ids: allModules });
  }
  ready = true;
}

async function modulesFor(userId: number): Promise<string[]> {
  const rows = await dbRows<{ module_id: string }>("odt_yetki_modules", { p_user_id: userId });
  return rows.map((r) => String(r.module_id));
}

async function okullarFor(userId: number): Promise<OkulId[]> {
  try {
    const raw = await dbRows<string>("odt_yetki_okullar", { p_user_id: userId });
    return temizOkullar(raw);
  } catch {
    return temizOkullar([]);
  }
}

function toYetki(row: UserRow, modules: string[], okullar: OkulId[]): OdtYetki {
  const isSuper = asOn(row.is_super);
  const pageMods = modules.filter((id) => ODT_PAGE_MODULES.some((m) => m.id === id));
  return {
    id: asId(row.id),
    email: String(row.email),
    name: String(row.full_name || ""),
    active: asOn(row.is_active),
    isSuper,
    modules: isSuper ? [...pageMods, "super"] : pageMods,
    okullar,
  };
}

export async function getYetki(email: string): Promise<OdtYetki | null> {
  await ensureSchema();
  const e = normEmail(email);
  if (!e) return null;
  const rows = await dbRows<UserRow>("odt_yetki_user_by_email", { p_email: e });
  const row = rows[0];
  if (!row) return null;
  const id = asId(row.id);
  const mods = await modulesFor(id);
  return toYetki(row, mods, await okullarFor(id));
}

export async function canLogin(email: string): Promise<boolean> {
  const e = normEmail(email);
  if (!isAllowedEmail(e)) return false;
  const y = await getYetki(e);
  return !!y && y.active;
}

export function firstOpenHref(y: OdtYetki): string {
  for (const item of ODT_NAV_ITEMS) {
    if (y.modules.includes(item.id)) return item.href;
  }
  return "/yetki-yok";
}

export function hasModule(y: OdtYetki, moduleId: string): boolean {
  if (moduleId === "super") return y.isSuper;
  return y.modules.includes(moduleId);
}

export async function requirePageModule(moduleId: string): Promise<OdtYetki> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) redirect("/login");
  const y = await getYetki(email);
  if (!y || !y.active) redirect("/yetki-yok");
  if (!hasModule(y, moduleId)) redirect("/yetki-yok");
  return y;
}

export async function requireApiModule(
  moduleId: string
): Promise<{ email: string; yetki: OdtYetki } | { response: NextResponse }> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) {
    return { response: NextResponse.json({ ok: false, error: "Giriş yok" }, { status: 401 }) };
  }
  const y = await getYetki(email);
  if (!y || !y.active) {
    return { response: NextResponse.json({ ok: false, error: "Giriş yok" }, { status: 401 }) };
  }
  if (!hasModule(y, moduleId)) {
    return { response: NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 }) };
  }
  return { email, yetki: y };
}

export async function listOdtUsers(): Promise<OdtYetki[]> {
  await ensureSchema();
  const rows = await dbRows<UserRow>("odt_yetki_users");
  const out: OdtYetki[] = [];
  for (const row of rows) {
    const id = asId(row.id);
    out.push(toYetki(row, await modulesFor(id), await okullarFor(id)));
  }
  return out;
}

function cleanModules(raw: unknown): string[] {
  const allowed = new Set(ODT_PAGE_MODULES.map((m) => m.id));
  const arr = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const x of arr) {
    const id = String(x);
    if (allowed.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

async function setOkullar(userId: number, raw: unknown): Promise<void> {
  const list = secilenOkullar(raw);
  // İkisi de seçiliyse kayıt tutmayız; boş liste iki okul demektir.
  const kayit = list.length >= 2 ? [] : list;
  await run("odt_yetki_okullar_set", { p_user_id: userId, p_okullar: kayit });
}

async function setModules(userId: number, modules: string[]): Promise<void> {
  await run("odt_yetki_modules_clear", { p_user_id: userId });
  if (modules.length) {
    await run("odt_yetki_modules_add", { p_user_id: userId, p_module_ids: modules });
  }
}

export async function createOdtUser(input: {
  actor: OdtYetki;
  email: string;
  name: string;
  modules: unknown;
  isSuper: boolean;
  okullar?: unknown;
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const email = normEmail(input.email);
  if (!email || !isAllowedEmail(email)) {
    return { ok: false, error: `Yalnızca izinli e-posta alan adları: ${allowedDomains().join(", ")}` };
  }
  if (email.length > 190) return { ok: false, error: "E-posta çok uzun." };
  const name = String(input.name ?? "").trim().slice(0, 190);
  const modules = cleanModules(input.modules);
  const okullar = secilenOkullar(input.okullar ?? ["alfaair", "northfly"]);
  if (!okullar.length) return { ok: false, error: "En az bir okul seçin." };
  const isSuper = !!input.isSuper;
  await ensureSchema();
  const exists = await dbRows<{ id: unknown }>("odt_yetki_user_id_by_email", { p_email: email });
  if (exists[0]) return { ok: false, error: "Bu e-posta zaten kayıtlı." };
  const rows = await dbRows<{ id: unknown }>("odt_yetki_user_insert", {
    p_email: email,
    p_name: name,
    p_is_super: isSuper,
  });
  const id = asId(rows[0]?.id);
  if (!id) return { ok: false, error: "Hesap eklenemedi." };
  await setModules(id, modules);
  await setOkullar(id, okullar);
  return { ok: true, id };
}

export async function saveOdtUser(input: {
  actor: OdtYetki;
  userId: number;
  modules: unknown;
  isSuper: boolean;
  active: boolean;
  okullar?: unknown;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = Number(input.userId);
  if (!userId) return { ok: false, error: "Kullanıcı yok." };
  await ensureSchema();
  const rows = await dbRows<UserRow>("odt_yetki_user_by_id", { p_id: userId });
  const row = rows[0];
  if (!row) return { ok: false, error: "Kullanıcı yok." };
  const self = asId(row.id) === input.actor.id;
  let isSuper = !!input.isSuper;
  let active = !!input.active;
  if (self) {
    isSuper = true;
    active = true;
  }
  if (normEmail(String(row.email)) === ODT_SUPER_EMAIL) {
    isSuper = true;
    active = true;
  }
  const okullar = secilenOkullar(input.okullar);
  if (!okullar.length) return { ok: false, error: "En az bir okul seçin." };
  await run("odt_yetki_user_update", { p_id: userId, p_is_super: isSuper, p_is_active: active });
  await setModules(userId, cleanModules(input.modules));
  await setOkullar(userId, okullar);
  return { ok: true };
}
