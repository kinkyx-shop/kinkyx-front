import rawPages from "../../data/pages.json";
import { slugify } from "@/lib/slug";
import { defaultLocale, locales, type Locale } from "@/i18n/ui";

type RawPage = {
  key: string;
  slug: Partial<Record<string, string>>;
  name: Partial<Record<string, string>>;
  html: Partial<Record<string, string>>;
};

export interface Page {
  key: string;
  slug: Record<Locale, string>;
  name: Record<Locale, string>;
  html: Record<Locale, string>;
}

const src = rawPages as Record<string, RawPage>;

// slug FR figé pour préserver le référencement existant
const FR_SLUG: Record<string, string> = {
  "latex-sur-mesure": "latex-sur-mesure",
  "guide-des-tailles": "guide-des-tailles",
  atelier: "atelier",
  "livraison-retour": "livraison-retour",
  revendeur: "revendeur",
  shooting: "shooting",
};

export const pages: Page[] = Object.values(src).map((p) => {
  const slug = {} as Record<Locale, string>;
  const name = {} as Record<Locale, string>;
  const html = {} as Record<Locale, string>;
  for (const lg of locales) {
    name[lg] = p.name[lg] || p.name.fr || p.key;
    html[lg] = p.html[lg] || p.html.fr || "";
    slug[lg] = lg === "fr" ? FR_SLUG[p.key] || slugify(name.fr) : slugify(name[lg]);
  }
  return { key: p.key, slug, name, html };
});

export function getPage(key: string): Page | undefined {
  return pages.find((p) => p.key === key);
}

export function pagePath(p: Page, locale: Locale): string {
  const s = p.slug[locale] || p.slug[defaultLocale];
  return locale === defaultLocale ? `/${s}/` : `/${locale}/${s}/`;
}

export function pageStaticPaths(locale: Locale) {
  return pages
    .filter((p) => p.html[locale] && p.slug[locale])
    .map((p) => ({ params: { page: p.slug[locale] }, props: { pageKey: p.key } }));
}
