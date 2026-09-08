import raw from "../../data/catalog.json";
import type { Locale } from "@/i18n/ui";
import { defaultLocale } from "@/i18n/ui";

/* ---------- types ---------- */
export type L10n = Record<Locale, string>;

export interface Category {
  key: number;
  parentKey: number | null;
  count: number;
  order: number;
  image: string | null;
  imageSrcset?: string | null;
  name: L10n;
  slug: L10n;
  desc: L10n;
  path: L10n;
}

export interface Variation {
  id: number;
  attrs: Record<string, string>;
  price: number | null;
  regularPrice: number | null;
  salePrice: number | null;
  onSale: boolean;
  sku: string;
  stock: string;
  image: string | null;
}

export interface ProductAttr {
  slug: string;
  label: string;
  forVariation: boolean;
  options: string[];
}

export interface Review {
  author: string;
  rating: number;
  date: string | null;
  verified: boolean;
  html: string;
}

export interface Product {
  key: number;
  type: string;
  sku: string;
  order: number;
  date: string | null;
  rating?: number | null;
  ratingCount?: number;
  reviews?: Review[];
  brand: string | null;
  onSale: boolean;
  stock: string;
  images: {
    src: string;
    srcset?: string | null;
    w?: number | null;
    h?: number | null;
    alt: string | null;
    id: number;
  }[];
  frPermalink: string | null;
  name: L10n;
  slug: L10n;
  short: L10n;
  desc: L10n;
  categoryKeys: number[];
  price: {
    min: number | null;
    max: number | null;
    regular: number | null;
    sale: number | null;
    onSale: boolean;
    currencyHtml: string | null;
  };
  attributes: ProductAttr[];
  variations: Variation[];
}

export interface GoogleReview {
  author: string;
  photo: string | null;
  rating: number;
  when: string;
  time: number;
  text: string;
}
export interface GoogleReviews {
  rating: number | null;
  total: number;
  url: string | null;
  reviews: GoogleReview[];
}

interface Catalog {
  generatedAt?: string;
  mode?: string;
  locales: Locale[];
  categories: Category[];
  products: Product[];
  attributes: Record<string, { slug: string; label: string; terms: { name: string; slug: string }[] }>;
  google?: GoogleReviews;
}

export const catalog = raw as unknown as Catalog;
export const isStub = catalog.mode !== "full";

/* ---------- URLs ---------- */

// préfixe du namespace produit par langue
const PRODUCT_BASE: Record<Locale, string> = { fr: "produit", en: "product", de: "produkt" };

export function categoryPath(cat: Category, locale: Locale): string {
  const p = cat.path[locale] || cat.path[defaultLocale];
  return locale === defaultLocale ? p : `/${locale}${p}`;
}

export function productPath(p: Product, locale: Locale): string {
  const s = p.slug[locale] || p.slug[defaultLocale];
  const base = `/${PRODUCT_BASE[locale]}/${s}/`;
  return locale === defaultLocale ? base : `/${locale}${base}`;
}

/* ---------- accès ---------- */

const byKey = new Map(catalog.categories.map((c) => [c.key, c]));

export function getCategory(key: number): Category | undefined {
  return byKey.get(key);
}

export function topCategories(): Category[] {
  return catalog.categories
    .filter((c) => !c.parentKey && c.slug.fr !== "non-classe" && c.slug.fr !== "uncategorised")
    .sort((a, b) => a.order - b.order);
}

export function childCategories(key: number): Category[] {
  return catalog.categories.filter((c) => c.parentKey === key).sort((a, b) => a.order - b.order);
}

export function ancestors(cat: Category): Category[] {
  const out: Category[] = [];
  let cur = cat.parentKey ? byKey.get(cat.parentKey) : undefined;
  let guard = 0;
  while (cur && guard++ < 12) {
    out.unshift(cur);
    cur = cur.parentKey ? byKey.get(cur.parentKey) : undefined;
  }
  return out;
}

/** Tous les produits d'une catégorie (et de ses sous-catégories). */
export function productsInCategory(key: number): Product[] {
  const keys = new Set<number>([key]);
  const walk = (k: number) => {
    for (const c of childCategories(k)) {
      if (!keys.has(c.key)) {
        keys.add(c.key);
        walk(c.key);
      }
    }
  };
  walk(key);
  return catalog.products
    .filter((p) => p.categoryKeys.some((k) => keys.has(k)))
    .sort((a, b) => a.order - b.order);
}

export function getProduct(key: number): Product | undefined {
  return catalog.products.find((p) => p.key === key);
}

/* ---------- prix ---------- */

const NBSP = " ";
const fmt = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatPrice(n: number | null): string {
  if (n == null) return "";
  return `${fmt.format(n)}${NBSP}€`;
}

export function priceLabel(p: Product, t: (k: any) => string): string {
  const { min, max } = p.price;
  if (min == null) return "";
  if (max != null && max > min) return `${t("product.from")} ${formatPrice(min)}`;
  return formatPrice(min);
}
