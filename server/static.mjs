/**
 * Préproduction front.kinkyx-shop.com (site « Node.js » Infomaniak).
 *  - sert le contenu statique de ./dist/ (produit par `astro build`)
 *  - proxifie /store-api/* vers la Store API WooCommerce, en injectant
 *    l'auth htaccess du dev côté serveur (le navigateur ne parle qu'à front.)
 *
 * En production, Apache sert dist/ et le proxy pointe vers back.kinkyx-shop.com.
 * Aucune dépendance — Node standard.
 */

import { createServer } from "node:http";
import { stat, readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = fileURLToPath(new URL("../dist/", import.meta.url));
const APP_DIR = fileURLToPath(new URL("../", import.meta.url));
const REBUILD_SCRIPT = fileURLToPath(new URL("../scripts/rebuild.mjs", import.meta.url));
const REDIRECTS_FILE = fileURLToPath(new URL("../data/redirects.json", import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

/* -------- redirections 301 ancien site (L6) --------
 * data/redirects.json : { products[], categories[], pages[], brands[] }
 * chaque ligne { from, to, to_en?, to_de? } — `from` = chemin FR de
 * l'ancien site (sans préfixe de langue). Un chemin entrant préfixé
 * /en/ ou /de/ (anciennes URLs GTranslate) est aussi reconnu : on retire
 * le préfixe, on cherche `from`, et on redirige vers to_en/to_de si présent,
 * sinon vers `to` (repli FR). Régénérer via `node scripts/build-redirects.mjs`
 * (idéalement contre les vraies données prod juste avant la bascule réelle).
 */
let REDIRECTS = new Map();
async function loadRedirects() {
  try {
    const raw = JSON.parse(await readFile(REDIRECTS_FILE, "utf8"));
    const map = new Map();
    for (const group of [raw.products, raw.categories, raw.pages, raw.brands]) {
      for (const row of group || []) map.set(row.from, row);
    }
    REDIRECTS = map;
    console.log(`[redirects] ${map.size} règles chargées`);
  } catch {
    console.log("[redirects] data/redirects.json absent — aucune redirection L6 active");
  }
}

function findRedirect(pathname) {
  // beaucoup de catégories gardent le même chemin FR dans le nouveau front
  // (from === to) : la ligne ne sert alors qu'au repli /en//de/ ci-dessous,
  // jamais à rediriger le chemin FR lui-même (sinon boucle sur lui-même).
  const direct = REDIRECTS.get(pathname);
  if (direct && direct.to !== pathname) return direct.to;
  for (const [prefix, field] of [["/en/", "to_en"], ["/de/", "to_de"]]) {
    if (pathname.startsWith(prefix)) {
      const row = REDIRECTS.get("/" + pathname.slice(prefix.length));
      if (row) {
        const target = row[field] || row.to;
        if (target !== pathname) return target;
      }
    }
  }
  return null;
}

// URLs système WordPress qui ne renaîtront jamais sur ce domaine après la
// bascule (WP part sur back.) : 410 plutôt que 404, signal fort pour Google.
const GONE_PATTERNS = [/\/feed\/?$/, /^\/wp-json\//, /^\/wp-admin\//, /^\/wp-login\.php/, /^\/xmlrpc\.php/, /\/attachment\//];

const CHECKOUT = (process.env.PUBLIC_CHECKOUT_URL || "https://dev.kinkyx-shop.com").replace(/\/+$/, "");
const STORE_BASE = `${CHECKOUT}/wp-json/wc/store/v1`;
const BASIC = process.env.SITE_BASIC_AUTH || "";

/* -------- webhook de reconstruction -------- */
const REBUILD_SECRET = process.env.REBUILD_SECRET || "";
const REBUILD_DEBOUNCE_MS = 20_000; // regroupe les rafales de webhooks
let rebuildTimer = null;
let rebuilding = false;
let rebuildQueued = false;

function runRebuild() {
  if (rebuilding) {
    rebuildQueued = true;
    return;
  }
  rebuilding = true;
  console.log("[rebuild] démarrage");
  const child = spawn(process.execPath, [REBUILD_SCRIPT], { cwd: APP_DIR, stdio: "inherit" });
  child.on("exit", (code) => {
    rebuilding = false;
    console.log(`[rebuild] terminé (code ${code})`);
    if (rebuildQueued) {
      rebuildQueued = false;
      scheduleRebuild();
    }
  });
}

function scheduleRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    runRebuild();
  }, REBUILD_DEBOUNCE_MS);
}

function handleRebuildHook(req, res) {
  if (!REBUILD_SECRET) {
    res.writeHead(503, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "rebuild désactivé (REBUILD_SECRET absent)" }));
  }
  const url = new URL(req.url, "http://x");
  const key = url.searchParams.get("key") || req.headers["x-kx-key"] || "";
  if (key !== REBUILD_SECRET) {
    res.writeHead(401, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "clé invalide" }));
  }
  scheduleRebuild();
  // 200 (pas 202) : la validation du webhook WooCommerce n'accepte que 200/201.
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, queued: true, running: rebuilding }));
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/* -------- proxy WooCommerce / WordPress (auth htaccess injectée côté serveur) --------
 *   /store-api/*  -> {CHECKOUT}/wp-json/wc/store/v1/*   (panier, stock)
 *   /site-api/*   -> {CHECKOUT}/wp-json/*               (formulaires, endpoints maison)
 */
async function proxyStore(req, res) {
  const isSite = req.url.startsWith("/site-api/");
  const path = req.url.replace(isSite ? /^\/site-api/ : /^\/store-api/, "");
  const target = isSite ? `${CHECKOUT}/wp-json${path}` : `${STORE_BASE}${path}`;

  const headers = { Accept: "application/json" };
  if (BASIC) headers.Authorization = "Basic " + Buffer.from(BASIC).toString("base64");
  for (const h of ["content-type", "cart-token", "nonce", "x-wc-store-api-nonce", "cookie"]) {
    if (req.headers[h]) headers[h] = req.headers[h];
  }

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks);
  }

  let upstream;
  try {
    upstream = await fetch(target, { method: req.method, headers, body });
  } catch (err) {
    res.writeHead(502, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "upstream", message: String(err) }));
  }

  res.statusCode = upstream.status;
  res.setHeader("content-type", upstream.headers.get("content-type") || "application/json");
  for (const h of ["cart-token", "nonce", "x-wc-store-api-nonce"]) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h.replace(/(^|-)([a-z])/g, (_, p, c) => p + c.toUpperCase()), v);
  }
  // Set-Cookie : plusieurs valeurs possibles, jamais fusionnables par une virgule
  // (getSetCookie() dédie une API à ça ; sinon on tente un repli best-effort).
  const setCookies =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : upstream.headers.get("set-cookie")
        ? [upstream.headers.get("set-cookie")]
        : [];
  if (setCookies.length) res.setHeader("set-cookie", setCookies);

  const text = await upstream.text();
  res.end(text);
}

/* -------- fichiers statiques -------- */
async function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const candidates = [];
  if (clean.endsWith("/")) candidates.push(join(ROOT, clean, "index.html"));
  else if (!extname(clean)) candidates.push(join(ROOT, clean, "index.html"), join(ROOT, `${clean}.html`));
  else candidates.push(join(ROOT, clean));
  for (const p of candidates) {
    try {
      if ((await stat(p)).isFile()) return p;
    } catch {}
  }
  return null;
}

const server = createServer(async (req, res) => {
  try {
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end("ok\n");
    }
    if (req.url.split("?")[0] === "/_hooks/rebuild") {
      if (req.method === "POST" || req.method === "GET") return handleRebuildHook(req, res);
      res.writeHead(405, { "content-type": "text/plain" });
      return res.end("method not allowed\n");
    }
    if (req.url.startsWith("/store-api/") || req.url.startsWith("/site-api/"))
      return proxyStore(req, res);

    const pathname = (req.url || "/").split("?")[0];
    if (GONE_PATTERNS.some((re) => re.test(pathname))) {
      res.writeHead(410, { "content-type": "text/plain; charset=utf-8" });
      return res.end("410 Gone\n");
    }
    const redirectTo = findRedirect(pathname);
    if (redirectTo) {
      res.writeHead(301, { location: redirectTo });
      return res.end();
    }

    let file = await resolveFile(req.url || "/");
    let status = 200;
    if (!file) {
      file = join(ROOT, "404.html");
      status = 404;
      try {
        await stat(file);
      } catch {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        return res.end("404 — build absent ? Lance `npm run build`.\n");
      }
    }
    const body = await readFile(file);
    const type = MIME[extname(file)] || "application/octet-stream";
    const cache = /[/\\]_astro[/\\]/.test(file)
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate";
    res.writeHead(status, { "content-type": type, "cache-control": cache });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("500\n");
    console.error(err);
  }
});

await loadRedirects();
server.listen(PORT, () => console.log(`[front] dist/ + proxy /store-api → ${STORE_BASE}  (port ${PORT})`));
