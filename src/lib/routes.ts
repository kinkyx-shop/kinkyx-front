import { catalog } from "@/lib/catalog";
import type { Locale } from "@/i18n/ui";

const SKIP = new Set(["non-classe", "uncategorised", "uncategorized", "nicht-kategorisiert"]);

/** Chemins statiques des archives catégories pour une langue. */
export function categoryStaticPaths(locale: Locale) {
  return catalog.categories
    .filter((c) => !SKIP.has(c.slug.fr))
    .map((c) => {
      const full = c.path[locale] || c.path.fr; // "/latex/femme/robe/"
      const path = full.replace(/^\/+|\/+$/g, ""); // "latex/femme/robe"
      return {
        params: { path: path || undefined },
        props: { categoryKey: c.key },
      };
    })
    .filter((r) => r.params.path);
}

/** Chemins statiques des fiches produit pour une langue (lot 2). */
export function productStaticPaths(locale: Locale) {
  return catalog.products.map((p) => ({
    params: { slug: p.slug[locale] || p.slug.fr },
    props: { productKey: p.key },
  }));
}
