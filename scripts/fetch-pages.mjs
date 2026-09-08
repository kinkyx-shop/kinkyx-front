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
// NB : cgv / cgu ont leur contenu dans un template Elementor séparé — le
// mu-plugin kinkyx-rest-pages le réinjecte dans content.rendered.
const PAGES = [
  "latex-sur-mesure",
  "guide-des-tailles",
  "livraison-retour",
  "cgv",
  "cgu",
  // atelier / revendeur / shooting : contenu de démo / vide côté WP — réintégrer
  // quand la boutique aura rédigé du vrai contenu.
];

const KEEP = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
  "a", "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark", "small",
  "blockquote", "figure", "figcaption", "img", "br", "hr", "pre", "code",
]);
const DROP_WITH_CONTENT = new Set(["script", "style", "noscript", "form", "svg", "iframe", "button", "input", "select", "textarea", "video", "audio"]);

/** Décode les entités HTML fréquentes (titres WP : « &#038; », « &rsquo; »…). */
function decodeEntities(s) {
  return String(s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&(?:rsquo|lsquo|#8217|#8216);/g, "’")
    .replace(/&(?:quot|#8220|#8221);/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

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

// Sections à couper entièrement à partir d'un titre (contenu jamais rempli côté WP).
const CUT_FROM = {
  "livraison-retour": /^(faq|questions?\s+fr[ée]quent|f\.?a\.?q)/i,
};

/** Retire le texte bouche-trou (lorem ipsum) et les titres de section devenus vides. */
function stripPlaceholders(root, key) {
  const LOREM = /lorem ipsum|consectet(?:ur)? adipiscing|eiusm(?:od)? por/i;
  for (const el of root.querySelectorAll("p, li, td, h1, h2, h3, h4, h5, h6, blockquote")) {
    if (LOREM.test((el.text || "").trim())) el.remove();
  }

  // coupe une section entière (titre + tout ce qui suit) sur les pages listées
  const cut = CUT_FROM[key];
  if (cut) {
    const kids0 = root.childNodes.filter((n) => n.nodeType === 1);
    const start = kids0.findIndex(
      (n) => /^h[1-6]$/i.test(n.rawTagName || "") && cut.test((n.text || "").trim()),
    );
    if (start >= 0) for (const n of kids0.slice(start)) n.remove();
  }

  const level = (n) => {
    const m = /^h([1-6])$/i.exec(n.rawTagName || "");
    return m ? Number(m[1]) : 0;
  };
  const kids = root.childNodes.filter((n) => n.nodeType === 1);
  for (let i = 0; i < kids.length; i++) {
    const lv = level(kids[i]);
    if (!lv) continue;
    // section vide : rien d'autre qu'un titre jusqu'au prochain titre de niveau <= lv
    let hasContent = false;
    for (let j = i + 1; j < kids.length; j++) {
      const lj = level(kids[j]);
      if (lj && lj <= lv) break;
      if (lj) continue;
      const tag = (kids[j].rawTagName || "").toLowerCase();
      if (
        (kids[j].text || "").trim() !== "" ||
        /^(ul|ol|table|figure|img|hr)$/.test(tag) ||
        kids[j].querySelector?.("img")
      ) {
        hasContent = true;
        break;
      }
    }
    if (!hasContent) kids[i].remove();
  }
}

function tidy(html, key) {
  const root = parse(html, { blockTextElements: { script: false, style: false } });
  clean(root);
  stripPlaceholders(root, key);
  let out = root.toString();
  out = out
    // coquilles connues des pages boutique
    .replace(/\bdefault de fabrication\b/gi, "défaut de fabrication")
    .replace(/\bles pris varient\b/gi, "les prix varient")
    // traînée de lorem collée à du vrai texte (« … New Zealand Lorem ipsum … »)
    .replace(/\s*Lorem ipsum[^<]*/gi, "")
    // éléments devenus vides
    .replace(/<(p|li|h[1-6]|blockquote|figcaption)[^>]*>(\s|&nbsp;)*<\/\1>/gi, "")
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
        entry.name[lg] = decodeEntities((page.title?.rendered || slug).replace(/<[^>]+>/g, "")).trim();
        entry.slug[lg] = page.slug;
        entry.html[lg] = tidy(page.content?.rendered || "", slug);
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
