/**
 * Étape 1 du build : tire le catalogue WooCommerce (toutes langues) dans
 * ./data/raw/*.json, puis lance la normalisation vers ./data/catalog.json.
 *
 *   node scripts/fetch-catalog.mjs [--strict]
 *
 * Tolérant : si le backend est injoignable ou si les clés manquent, écrit
 * un catalogue vide et sort en 0 pour ne pas casser le build.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { wc, wcAll, ping } from "../src/lib/woo.mjs";
import { normalize } from "./normalize.mjs";
import { fetchPages } from "./fetch-pages.mjs";

const DATA = new URL("../data/", import.meta.url);
const RAW = new URL("../data/raw/", import.meta.url);
const STRICT = process.argv.includes("--strict");

async function save(dir, name, data) {
  await writeFile(new URL(`${name}.json`, dir), JSON.stringify(data));
  const n = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`  ${dir === RAW ? "raw/" : ""}${name}.json  (${n})`);
}

async function emptyCatalog(reason) {
  await save(DATA, "catalog", {
    generatedAt: new Date().toISOString(),
    mode: "stub",
    reason,
    locales: ["fr", "en", "de"],
    categories: [],
    products: [],
    attributes: {},
  });
  await writeFile(new URL("pages.json", DATA), JSON.stringify({}));
  console.warn(`\n⚠ Catalogue vide (${reason}). Le build continue.\n`);
}

async function main() {
  await mkdir(RAW, { recursive: true });

  const url = process.env.WOO_API_URL || "(WOO_API_URL absente)";
  console.log(`→ WooCommerce : ${url}`);
  let status;
  try {
    status = await ping();
  } catch (e) {
    status = { ok: false, error: e.message };
  }
  console.log("  ", JSON.stringify(status));

  if (!status.ok || status.storeApiOnly) {
    const reason = !status.ok ? "backend injoignable" : "clés API REST manquantes";
    if (STRICT) {
      console.error(`\n✗ ${reason}\n`);
      process.exit(1);
    }
    return emptyCatalog(reason);
  }

  try {
    console.log("→ Catégories (toutes langues)…");
    const categories = await wcAll("wc/v3/products/categories", {
      hide_empty: false,
      _fields: "id,name,slug,parent,description,count,image,menu_order,lang,translations",
    });
    await save(RAW, "categories", categories);

    console.log("→ Attributs + termes…");
    const attributes = await wcAll("wc/v3/products/attributes");
    const attributeTerms = {};
    for (const a of attributes) {
      attributeTerms[a.id] = await wcAll(`wc/v3/products/attributes/${a.id}/terms`, {
        _fields: "id,name,slug,menu_order",
      });
    }
    await save(RAW, "attributes", { attributes, terms: attributeTerms });

    console.log("→ Produits (toutes langues)…");
    const products = await wcAll("wc/v3/products", {
      status: "publish",
      orderby: "menu_order",
      order: "asc",
      _fields:
        "id,name,slug,permalink,type,status,sku,price,regular_price,sale_price,on_sale,price_html," +
        "stock_status,short_description,description,categories,tags,brands,images," +
        "attributes,default_attributes,variations,external_url,button_text," +
        "average_rating,rating_count,date_modified,lang,translations",
    });
    await save(RAW, "products", products);

    // Variations : uniquement pour les produits variables FR (source de vérité).
    const frVariable = products.filter((p) => p.lang === "fr" && p.type === "variable");
    console.log(`→ Variations de ${frVariable.length} produits variables FR…`);
    const variations = {};
    let done = 0;
    for (const p of frVariable) {
      variations[p.id] = await wcAll(`wc/v3/products/${p.id}/variations`, {
        _fields:
          "id,sku,price,regular_price,sale_price,on_sale,stock_status,stock_quantity,attributes,image",
      });
      if (++done % 30 === 0) console.log(`   ${done}/${frVariable.length}`);
    }
    await save(RAW, "variations", variations);

    console.log("→ Normalisation…");
    const catalog = normalize({ categories, products, attributes, attributeTerms, variations });
    catalog.generatedAt = new Date().toISOString();
    catalog.mode = "full";
    await save(DATA, "catalog", catalog);

    console.log("→ Pages de contenu…");
    await fetchPages().catch((e) => console.warn("  pages KO :", e.message));

    console.log(
      `\n✓ ${catalog.products.length} produits · ${catalog.categories.length} catégories · ` +
        `${Object.values(variations).reduce((n, v) => n + v.length, 0)} variations\n`,
    );
  } catch (err) {
    if (STRICT) {
      console.error("\n✗", err.stack || err.message, "\n");
      process.exit(1);
    }
    await emptyCatalog(`erreur : ${err.message}`);
  }
}

main().catch(async (err) => {
  if (STRICT) {
    console.error("\n✗", err.stack || err.message, "\n");
    process.exit(1);
  }
  await emptyCatalog(err.message);
});
