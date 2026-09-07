/**
 * Tire les pages de contenu (WordPress/Elementor) et nettoie leur HTML
 * pour ne garder que le contenu sémantique. Sortie : data/pages.json
 *
 *   node --env-file-if-exists=.env scripts/fetch-pages.mjs
 *
 * Appelé par scripts/fetch-catalog.mjs (donc par `npm run build`).
 */

import { writeFile, mkdir } from "node:fs/promises";
import { parse } from "node-html-parser";

const API = (process.env.WOO_API_URL || "https://dev.kinkyx-shop.com/wp-json").replace(/\/+$/, "");
const BASIC = process.env.SITE_BASIC_AUTH || "";
const OUT = new URL("../data/", import.meta.url);

// slug FR → { clé interne }.  Les traductions sont résolues via l'API Polylang
// (mu-plugins kinkyx-rest-lang + kinkyx-rest-pages sur le back).
// NB : cgv / cgu sont rendues par un template Elementor (Theme Builder), leur
// `content.rendered` est vide via l'API → exclues ici, liens footer → back.
const PAGES = [
  "latex-sur-mesure",
  "guide-des-tailles",
  "atelier",
  "livraison-retour",
  "revendeur",
  "shooting",
];

const KEEP = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
  "a", "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark", "small",
  "blockquote", "figure", "figcaption", "img", "br", "hr", "pre", "code",
]);
const DROP_WITH_CONTENT = new Set(["script", "style", "noscript", "form", "svg", "iframe", "button", "input", "select", "textarea", "video", "audio"]);

function fixUrl(u) {
  if (!u) return u;
  // médias du dev → gardés absolus (proxy CDN plus tard) ; liens internes → relatifs
  if (/^https?:\/\/(dev|www)\.kinkyx-shop\.com\/wp-content\//.test(u)) return u;
  return u.replace(/^https?:\/\/(dev|www)\.kinkyx-shop\.com/, "");
}

function clean(node) {
  if (node.nodeType === 3) return; // texte

  for (const child of [...node.childNodes]) {
    if (child.nodeType === 3) continue;
    const tag = child.rawTagName?.toLowerCase();
    if (!tag) {
      child.remove();
      continue;
    }
    if (DROP_WITH_CONTENT.has(tag)) {
      child.remove();
      continue;
    }
    clean(child);
    if (KEEP.has(tag)) {
      // attributs autorisés uniquement
      const allowed =
        tag === "a" ? ["href"] : tag === "img" ? ["src", "alt"] : ["colspan", "rowspan"].filter(() => tag === "td" || tag === "th");
      for (const a of Object.keys(child.attributes)) {
        if (!allowed.includes(a)) child.removeAttribute(a);
      }
      if (tag === "a" && child.getAttribute("href")) child.setAttribute("href", fixUrl(child.getAttribute("href")));
      if (tag === "img") {
        const s = fixUrl(child.getAttribute("src") || child.getAttribute("data-src"));
        if (!s) {
          child.remove();
          continue;
        }
        child.setAttribute("src", s);
        child.setAttribute("loading", "lazy");
        if (!child.getAttribute("alt")) child.setAttribute("alt", "");
      }
    } else {
      // conteneur : on remonte le contenu, on jette l'enveloppe
      child.replaceWith(child.innerHTML);
    }
  }
}

function tidy(html) {
  const root = parse(html, { blockTextElements: { script: false, style: false } });
  clean(root);
  let out = root.toString();
  out = out
    .replace(/<p>\s*(&nbsp;|\s)*<\/p>/gi, "")
    .replace(/(\r?\n\s*){3,}/g, "\n\n")
    .replace(/\s+</g, (m) => (m.includes("\n") ? "\n<" : " <"))
    .trim();
  return out;
}

async function wp(path) {
  const headers = { Accept: "application/json" };
  if (BASIC) headers.Authorization = "Basic " + Buffer.from(BASIC).toString("base64");
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export async function fetchPages() {
  await mkdir(OUT, { recursive: true });
  const result = {};

  for (const slug of PAGES) {
    try {
      const list = await wp(`/wp/v2/pages?slug=${slug}&_fields=id,slug,title,content,lang,translations`);
      const fr = list[0];
      if (!fr) {
        console.warn(`  page « ${slug} » introuvable`);
        continue;
      }
      const langs = fr.translations && Object.keys(fr.translations).length ? fr.translations : { fr: { id: fr.id } };
      const entry = { key: slug, slug: {}, name: {}, html: {} };

      for (const [lg, ref] of Object.entries(langs)) {
        const page =
          ref.id === fr.id
            ? fr
            : await wp(`/wp/v2/pages/${ref.id}?_fields=id,slug,title,content`).catch(() => null);
        if (!page) continue;
        entry.name[lg] = (page.title?.rendered || slug).replace(/<[^>]+>/g, "").trim();
        entry.slug[lg] = page.slug;
        entry.html[lg] = tidy(page.content?.rendered || "");
      }
      result[slug] = entry;
      console.log(`  ${slug} → ${Object.keys(entry.html).join(",")}`);
    } catch (e) {
      console.warn(`  page « ${slug} » : ${e.message}`);
    }
  }

  await writeFile(new URL("pages.json", OUT), JSON.stringify(result));
  console.log(`  data/pages.json (${Object.keys(result).length} pages)`);
  return result;
}
