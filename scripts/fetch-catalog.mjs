/**
 * Étape 1 du build : tire le catalogue depuis WooCommerce et l'écrit
 * dans ./data/*.json, que les pages Astro lisent ensuite.
 *
 *   node scripts/fetch-catalog.mjs
 *
 * Lot 0 : squelette. On récupère et on range les données brutes ;
 * la normalisation (matrice de variations, i18n des attributs, arbre
 * de catégories) arrive au lot 1.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { wc, wcAll, ping } from "../src/lib/woo.mjs";

const OUT = new URL("../data/", import.meta.url);

async function save(name, data) {
  await writeFile(new URL(`${name}.json`, OUT), JSON.stringify(data, null, 2));
  const n = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`  data/${name}.json  (${n} entrées)`);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  console.log("→ Connexion WooCommerce…");
  const status = await ping();
  console.log("  ", JSON.stringify(status));
  if (!status.ok) {
    console.error("\n✗ Backend injoignable. Vérifie WOO_API_URL et les clés API dans .env\n");
    process.exit(1);
  }
  if (status.storeApiOnly) {
    console.warn("\n⚠ Clés API REST absentes ou invalides — seule la Store API répond.");
    console.warn("  Ajoute WOO_CONSUMER_KEY / WOO_CONSUMER_SECRET dans .env pour le build complet.\n");
    await save("_meta", { fetchedAt: new Date().toISOString(), mode: "store-api-only" });
    return;
  }

  console.log("→ Catégories…");
  const categories = await wcAll("wc/v3/products/categories", { orderby: "menu_order", hide_empty: false });
  await save("categories", categories);

  console.log("→ Attributs globaux…");
  const attributes = await wcAll("wc/v3/products/attributes");
  const attributeTerms = {};
  for (const a of attributes) {
    attributeTerms[a.id] = await wcAll(`wc/v3/products/attributes/${a.id}/terms`);
  }
  await save("attributes", { attributes, terms: attributeTerms });

  console.log("→ Produits (résumé)…");
  const products = await wcAll("wc/v3/products", {
    status: "publish",
    orderby: "date",
    order: "desc",
    _fields:
      "id,name,slug,type,status,permalink,sku,price,regular_price,sale_price,on_sale,price_html,stock_status,short_description,description,categories,tags,brands,images,attributes,default_attributes,variations,average_rating,rating_count,date_modified",
  });
  await save("products", products);

  const variableIds = products.filter((p) => p.type === "variable").map((p) => p.id);
  console.log(`→ Variations de ${variableIds.length} produits variables…`);
  const variations = {};
  let done = 0;
  for (const id of variableIds) {
    variations[id] = await wcAll(`wc/v3/products/${id}/variations`, {
      _fields: "id,sku,price,regular_price,sale_price,on_sale,stock_status,stock_quantity,attributes,image",
    });
    if (++done % 25 === 0) console.log(`   ${done}/${variableIds.length}`);
  }
  await save("variations", variations);

  await save("_meta", {
    fetchedAt: new Date().toISOString(),
    mode: "full",
    counts: {
      categories: categories.length,
      products: products.length,
      variableProducts: variableIds.length,
      variations: Object.values(variations).reduce((n, v) => n + v.length, 0),
    },
  });

  console.log("\n✓ Catalogue récupéré dans ./data/\n");
}

main().catch((err) => {
  console.error("\n✗", err.message, "\n");
  process.exit(1);
});
