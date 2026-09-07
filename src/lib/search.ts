import type { Locale } from "@/i18n/ui";
import {
  catalog,
  isStub,
  getCategory,
  categoryPath,
  productPath,
  formatPrice,
  type Product,
} from "@/lib/catalog";
import { pages, pagePath } from "@/lib/pages";

/** Enregistrement compact de l'index de recherche (clés courtes = JSON inline léger). */
export interface SearchDoc {
  t: string; // titre
  u: string; // URL
  s?: string; // sous-titre (catégorie / rubrique)
  img?: string; // vignette
  p?: string; // prix formaté
  kw?: string; // mots-clés supplémentaires (marque, réf.)
}

function categoryLabel(p: Product, locale: Locale): string | undefined {
  for (const k of p.categoryKeys) {
    const c = getCategory(k);
    if (c) return c.name[locale] || c.name.fr;
  }
  return undefined;
}

/** Construit l'index de recherche pour une langue (produits + catégories + pages). */
export function buildSearchIndex(locale: Locale): SearchDoc[] {
  if (isStub) return [];
  const docs: SearchDoc[] = [];

  for (const p of catalog.products) {
    const range =
      p.price.max != null && p.price.min != null && p.price.max > p.price.min;
    docs.push({
      t: p.name[locale] || p.name.fr,
      u: productPath(p, locale),
      s: categoryLabel(p, locale),
      img: p.images[0]?.src,
      p: p.price.min != null ? (range ? "≥ " : "") + formatPrice(p.price.min) : undefined,
      kw: [p.brand, p.sku].filter(Boolean).join(" ") || undefined,
    });
  }

  for (const c of catalog.categories) {
    if (!c.count || c.slug.fr === "non-classe" || c.slug.fr === "uncategorised") continue;
    docs.push({
      t: c.name[locale] || c.name.fr,
      u: categoryPath(c, locale),
      s: undefined,
      img: c.image || undefined,
    });
  }

  for (const pg of pages) {
    if (!pg.html[locale]) continue;
    docs.push({ t: pg.name[locale] || pg.name.fr, u: pagePath(pg, locale) });
  }

  return docs;
}
