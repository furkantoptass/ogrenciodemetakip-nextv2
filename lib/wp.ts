function wpBase(): string {
  return (process.env.WP_BASE_URL || "https://northfly.aero/wp-json").replace(/\/$/, "");
}

function wpAuth(): string {
  const user = process.env.WP_USER?.trim();
  const pass = process.env.WP_APP_PASSWORD?.trim();
  if (!user || !pass) throw new Error("WordPress anahtarı yok");
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

export async function wpGet<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${wpBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: { Authorization: wpAuth(), Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(res.ok ? "WordPress yanıtı okunamadı" : `WordPress ${res.status}`);
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "message" in data && typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : `WordPress ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function wpToplam(path: string): Promise<number> {
  const joiner = path.includes("?") ? "&" : "?";
  const url = path.startsWith("http") ? path : `${wpBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(`${url}${joiner}per_page=1`, {
    headers: { Authorization: wpAuth(), Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "message" in data && typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : `WordPress ${res.status}`;
    throw new Error(msg);
  }
  const header = Number(res.headers.get("X-WP-Total") || res.headers.get("x-wp-total") || 0);
  if (header > 0) return header;
  return Array.isArray(data) ? data.length : 0;
}

export type WpEntry = {
  entry_id: string | number;
  form_id: string | number;
  date?: string;
  status?: string;
  fields?: Record<string, string>;
};

export type WpFormPost = {
  ID?: number;
  id?: number;
  post_title?: string;
  title?: string;
  post_content?: string;
};

export type WpSeoRow = {
  id: number;
  link: string;
  title?: { raw?: string; rendered?: string };
  rank_math_seo_score?: string | number;
  rank_math_focus_keyword?: string;
  rank_math_title?: string;
  rank_math_description?: string;
};

export async function wpGetPaged<T>(path: string, perPage = 100, maxPages = 20): Promise<T[]> {
  const out: T[] = [];
  const joiner = path.includes("?") ? "&" : "?";
  for (let page = 1; page <= maxPages; page += 1) {
    const chunk = await wpGet<T[]>(`${path}${joiner}per_page=${perPage}&page=${page}`);
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    out.push(...chunk);
    if (chunk.length < perPage) break;
  }
  return out;
}
