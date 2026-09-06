/**
 * Client REST WooCommerce — utilisé uniquement au moment du build
 * (Node), jamais côté navigateur. Le navigateur parle à la Store API.
 *
 * Auth : clés API en query string (?consumer_key/&consumer_secret) pour
 * laisser l'en-tête Authorization disponible à la protection htaccess du
 * site de dev (SITE_BASIC_AUTH).
 */

const API_URL = process.env.WOO_API_URL || "https://dev.kinkyx-shop.com/wp-json";
const CK = process.env.WOO_CONSUMER_KEY || "";
const CS = process.env.WOO_CONSUMER_SECRET || "";
const BASIC = process.env.SITE_BASIC_AUTH || "";

function headers() {
  const h = { Accept: "application/json" };
  if (BASIC) h.Authorization = "Basic " + Buffer.from(BASIC).toString("base64");
  return h;
}

function url(path, params = {}) {
  const u = new URL(`${API_URL}/${path.replace(/^\/+/, "")}`);
  if (CK && CS) {
    u.searchParams.set("consumer_key", CK);
    u.searchParams.set("consumer_secret", CS);
  }
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  return u;
}

/** Un appel simple. */
export async function wc(path, params = {}) {
  const res = await fetch(url(path, params), { headers: headers() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`WooCommerce ${path} → ${res.status} ${res.statusText}\n${body.slice(0, 400)}`);
  }
  return res.json();
}

/** Pagine automatiquement (X-WP-TotalPages) et concatène. */
export async function wcAll(path, params = {}, { perPage = 100, delayMs = 120 } = {}) {
  const out = [];
  let page = 1;
  for (;;) {
    const res = await fetch(url(path, { ...params, per_page: perPage, page }), { headers: headers() });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`WooCommerce ${path} (page ${page}) → ${res.status}\n${body.slice(0, 400)}`);
    }
    const batch = await res.json();
    out.push(...batch);
    const totalPages = Number(res.headers.get("x-wp-totalpages") || "1");
    if (page >= totalPages || batch.length === 0) break;
    page += 1;
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }
  return out;
}

/** Test de connectivité — renvoie { ok, environment, wcVersion }. */
export async function ping() {
  const sys = await wc("wc/v3/system_status").catch(() => null);
  if (sys) {
    return {
      ok: true,
      environment: sys.environment?.home_url,
      wcVersion: sys.environment?.version,
      productCount: sys.settings?.product_count,
    };
  }
  // repli : la Store API publique
  const res = await fetch(`${API_URL}/wc/store/v1/products?per_page=1`, { headers: headers() });
  return { ok: res.ok, storeApiOnly: true, status: res.status };
}
