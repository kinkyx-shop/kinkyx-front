/**
 * Serveur de fichiers statiques pour la préproduction front.kinkyx-shop.com
 * (site « Node.js » Infomaniak). Sert le contenu de ./dist/ produit par
 * `astro build`. En production, ce rôle passera à Apache directement.
 *
 * Aucune dépendance — Node standard.
 */

import { createServer } from "node:http";
import { stat, readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../dist/", import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

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

async function resolveFile(urlPath) {
  // sécurité : pas de remontée hors de dist/
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const candidates = [];
  if (clean.endsWith("/")) {
    candidates.push(join(ROOT, clean, "index.html"));
  } else if (!extname(clean)) {
    candidates.push(join(ROOT, clean, "index.html"), join(ROOT, `${clean}.html`));
  } else {
    candidates.push(join(ROOT, clean));
  }
  for (const p of candidates) {
    try {
      const s = await stat(p);
      if (s.isFile()) return p;
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
    const cache = /\/_astro\//.test(file)
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

server.listen(PORT, () => console.log(`[static] dist/ servi sur le port ${PORT}`));
