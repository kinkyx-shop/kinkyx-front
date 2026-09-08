/**
 * Transforme les données brutes WooCommerce (toutes langues) en un
 * catalogue normalisé, langue de référence = FR, EN/DE en surcouche.
 *
 * Sortie : { locales, categories[], products[], attributes{} }
 *  - categories[i] = { key, parentKey, count, image, order,
 *                      name:{fr,en,de}, slug:{fr,en,de}, desc:{fr,en,de},
 *                      path:{fr,en,de} }              (chemin complet avec ancêtres)
 *  - products[i]   = { key, type, sku, order, images[], brand,
 *                      name/slug/short/desc: {fr,en,de},
 *                      categoryKeys[], price{min,max,regular,sale,onSale,currencyHtml},
 *                      attributes[{slug,label,forVariation,options[]}],
 *                      variations[{attrs{slug:opt}, price, regularPrice, salePrice, sku, stock}] }
 *  - `key` = ID du post FR (identifiant stable inter-langues).
 */

const LOCALES = ["fr", "en", "de"];

// translittération allemande AVANT le retrait des diacritiques,
// sinon « Große Größe » → « gro-e-gro-e »
const DE_MAP = { ä: "ae", ö: "oe", ü: "ue", ß: "ss", Ä: "ae", Ö: "oe", Ü: "ue" };

/** Décode les entités HTML fréquentes des noms WooCommerce (« &amp; », « &#038; »). */
function decodeEntities(s) {
  return String(s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

export function slugify(input) {
  return decodeEntities(input)
    .replace(/[äöüßÄÖÜ]/g, (c) => DE_MAP[c] || c)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // enlève les accents décomposés
    .replace(/["'’]/g, "")
    .replace(/[&]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function stripHtml(s) {
  return decodeEntities(String(s || "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function toNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** Regroupe une liste d'objets {id,lang,translations} par groupe de traduction. */
function groupByTranslation(items) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const groups = [];
  const seen = new Set();
  for (const it of items) {
    if (seen.has(it.id)) continue;
    const group = {};
    const tr = it.translations && Object.keys(it.translations).length ? it.translations : { [it.lang || "fr"]: { id: it.id } };
    for (const [lg, ref] of Object.entries(tr)) {
      const member = byId.get(ref.id) || (ref.id === it.id ? it : null);
      if (member) {
        group[lg] = member;
        seen.add(member.id);
      }
    }
    if (!group.fr) {
      // pas de FR : on rattache la 1re langue dispo comme référence
      const first = Object.values(group)[0];
      if (first) group.fr = first;
    }
    if (group.fr) groups.push(group);
  }
  return groups;
}

/** Assure l'unicité des slugs dans un ensemble donné. */
function uniqueSlug(base, used) {
  let s = base || "x";
  let i = 2;
  while (used.has(s)) s = `${base}-${i++}`;
  used.add(s);
  return s;
}

export function normalize({ categories, products, attributes, attributeTerms, variations }) {
  /* ---------- Catégories ---------- */
  const catGroups = groupByTranslation(categories);
  const catByFrId = new Map();
  // unicité des slugs PAR PARENT (pas globale) : deux « Top » sous des branches
  // différentes gardent le slug « top », leur chemin complet suffit à les distinguer.
  const slugUsed = new Map(); // clé `${parentId}|${lg}` -> Set<slug>

  const cats = catGroups.map((g) => {
    const fr = g.fr;
    const name = {}, slug = {}, desc = {};
    const pk = fr.parent || 0;
    for (const lg of LOCALES) {
      const m = g[lg] || fr;
      name[lg] = stripHtml(m.name);
      desc[lg] = stripHtml(m.description);
      const bucket = `${pk}|${lg}`;
      if (!slugUsed.has(bucket)) slugUsed.set(bucket, new Set());
      slug[lg] = uniqueSlug(slugify(m.name), slugUsed.get(bucket));
    }
    const cat = {
      key: fr.id,
      parentKey: fr.parent || null,
      count: fr.count || 0,
      order: fr.menu_order || 0,
      image: fr.image?.src || null,
      name, slug, desc,
      path: {},
    };
    catByFrId.set(fr.id, cat);
    return cat;
  });

  // chemins complets (avec ancêtres) par langue
  const resolvePath = (cat, lg, guard = 0) => {
    if (guard > 10) return `/${cat.slug[lg]}/`;
    const parent = cat.parentKey ? catByFrId.get(cat.parentKey) : null;
    const prefix = parent ? resolvePath(parent, lg, guard + 1) : "/";
    return `${prefix}${cat.slug[lg]}/`;
  };
  for (const cat of cats) {
    for (const lg of LOCALES) cat.path[lg] = resolvePath(cat, lg);
  }

  /* ---------- Attributs (labels FR pour l'instant) ---------- */
  const attrMap = {};
  for (const a of attributes || []) {
    attrMap[`pa_${a.slug || a.name}`] = {
      slug: `pa_${a.slug || a.name}`,
      label: a.name,
      terms: (attributeTerms?.[a.id] || []).map((t) => ({ name: t.name, slug: t.slug })),
    };
  }

  /* ---------- Produits ---------- */
  const prodGroups = groupByTranslation(products);
  const prodSlugUsed = { fr: new Set(), en: new Set(), de: new Set() };

  const prods = prodGroups.map((g) => {
    const fr = g.fr;
    const name = {}, slug = {}, short = {}, desc = {};
    for (const lg of LOCALES) {
      const m = g[lg] || fr;
      name[lg] = stripHtml(m.name);
      short[lg] = stripHtml(m.short_description);
      desc[lg] = String(m.description || "").trim();
      slug[lg] = uniqueSlug(slugify(m.name), prodSlugUsed[lg]);
    }

    // catégories : IDs de la version FR -> clés canoniques
    const categoryKeys = (fr.categories || [])
      .map((c) => c.id)
      .filter((id) => catByFrId.has(id));

    // attributs déclarés sur le produit FR
    const productAttrs = (fr.attributes || []).map((a) => ({
      slug: a.slug || `pa_${slugify(a.name)}`,
      label: a.name,
      forVariation: !!a.variation,
      options: a.options || [],
    }));

    // matrice de variations (produit FR variable)
    const rawVars = variations?.[fr.id] || [];
    const varMatrix = rawVars.map((v) => {
      const attrs = {};
      for (const va of v.attributes || []) {
        attrs[va.slug || `pa_${slugify(va.name)}`] = va.option;
      }
      return {
        id: v.id,
        attrs,
        price: toNum(v.price),
        regularPrice: toNum(v.regular_price),
        salePrice: toNum(v.sale_price),
        onSale: !!v.on_sale,
        sku: v.sku || "",
        stock: v.stock_status || "instock",
        image: v.image?.src || null,
      };
    });

    const prices = varMatrix.length
      ? varMatrix.map((v) => v.price).filter((n) => n != null)
      : [toNum(fr.price)].filter((n) => n != null);
    const priceMin = prices.length ? Math.min(...prices) : null;
    const priceMax = prices.length ? Math.max(...prices) : null;

    return {
      key: fr.id,
      type: fr.type,
      sku: fr.sku || "",
      order: fr.menu_order || 0,
      date: fr.date_created || fr.date_modified || null,
      brand: (fr.brands && fr.brands[0]?.name) || null,
      onSale: !!fr.on_sale,
      stock: fr.stock_status || "instock",
      images: (fr.images || []).map((im) => ({
        src: im.src,
        srcset: im.srcset || null,
        w: im.width || null,
        h: im.height || null,
        alt: stripHtml(im.alt) || null,
        id: im.id,
      })),
      frPermalink: fr.permalink || null,
      name, slug, short, desc,
      categoryKeys,
      price: {
        min: priceMin,
        max: priceMax,
        regular: toNum(fr.regular_price),
        sale: toNum(fr.sale_price),
        onSale: !!fr.on_sale,
        currencyHtml: fr.price_html || null,
      },
      attributes: productAttrs,
      variations: varMatrix,
    };
  });

  return {
    locales: LOCALES,
    categories: cats.sort((a, b) => a.order - b.order || a.name.fr.localeCompare(b.name.fr)),
    products: prods.sort((a, b) => a.order - b.order),
    attributes: attrMap,
  };
}
