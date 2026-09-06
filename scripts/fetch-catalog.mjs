/**
 * Étape 1 du build : tire le catalogue depuis WooCommerce et l'écrit
 * dans ./data/*.json, que les pages Astro lisent ensuite.
 *
 *   node scripts/fetch-catalog.mjs
 *
 * Tolérant : si le backend est injoignable ou si les clés API manquent,
 * on écrit des fichiers vides et on sort en 0 pour ne pas casser le build.
 * (Utile au premier déploiement, avant d'avoir renseigné les variables.)
 */

import { mkdir, writeFile } from "node:fs/promises";
import { wcAll, ping } from "../src/lib/woo.mjs";

const OUT = new URL("../data/", import.meta.url);
const STRICT = process.argv.includes("--strict");

async function save(name, data) {
  await writeFile(new URL(`${name}.json`, OUT), JSON.stringify(data, null, 2));
  const n = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`  data/${name}.json  (${n} entrées)`);
}

async function stubs(reason) {
  await save("categories", []);
  await save("attributes", { attributes: [], terms: {} });
  await save("products", []);
  await save("variations", {});
  await save("_meta", { fetchedAt: new Date().toISOString(), mode: "stub", reason });
  console.warn(`\n⚠ Catalogue non récupéré (${reason}). Fichiers vides écrits — le build continue.\n`);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  console.log("→ Connexion WooCommerce…", process.env.WOO_API_URL || "(WOO_API_URL absente)");
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
    await stubs(reason);
    return;
  }

  try {
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

    console.log("→ Produits…");
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
  } catch (err) {
    if (STRICT) {
      console.error("\n✗", err.message, "\n");
      process.exit(1);
    }
    await stubs(`erreur en cours de récupération : ${err.message}`);
  }
}

main().catch(async (err) => {
  if (STRICT) {
    console.error("\n✗", err.message, "\n");
    process.exit(1);
  }
  await stubs(err.message);
});
