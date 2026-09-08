import type { Locale } from "@/i18n/ui";
import { ui } from "@/i18n/ui";
import { ACCOUNT_URL } from "@/consts";
import { localizedPath } from "@/i18n/utils";
import { topCategories, childCategories, categoryPath } from "@/lib/catalog";
import { getPage, pagePath } from "@/lib/pages";

export interface NavItem {
  label: string;
  href: string;
  children: { label: string; href: string }[];
}

const T = (locale: Locale, key: keyof (typeof ui)["fr"]) => ui[locale][key] ?? ui.fr[key] ?? key;

function pageLink(key: string, locale: Locale, fallbackSlug: string, label: string): { label: string; href: string } {
  const p = getPage(key);
  return { label: p ? p.name[locale] || p.name.fr : label, href: p ? pagePath(p, locale) : localizedPath(`/${fallbackSlug}/`, locale) };
}

/** Menu principal : 2 univers catalogue + Sur-mesure + Guide des tailles. */
export function mainNav(locale: Locale): NavItem[] {
  const roots = topCategories().filter((c) => ["latex", "chaussures"].includes(c.slug.fr));

  const catNodes: NavItem[] = roots.map((c) => ({
    label: c.name[locale] || c.name.fr,
    href: categoryPath(c, locale),
    children: childCategories(c.key).map((cc) => ({
      label: cc.name[locale] || cc.name.fr,
      href: categoryPath(cc, locale),
    })),
  }));

  const bespoke = pageLink("latex-sur-mesure", locale, "latex-sur-mesure", T(locale, "nav.bespoke"));
  const sizes = pageLink("guide-des-tailles", locale, "guide-des-tailles", "Guide des tailles");

  // atelier / revendeur / shooting : pages non rédigées côté boutique -> hors nav
  return [
    ...catNodes,
    { label: bespoke.label, href: bespoke.href, children: [] },
    { label: sizes.label, href: sizes.href, children: [] },
  ];
}

/** Liens du pied de page « service client ». */
export function footerLinks(locale: Locale) {
  return [
    pageLink("livraison-retour", locale, "livraison-retour", T(locale, "footer.delivery")),
    pageLink("cgv", locale, "cgv", T(locale, "footer.terms")),
    pageLink("cgu", locale, "cgu", T(locale, "footer.termsUse")),
    { label: T(locale, "nav.account"), href: ACCOUNT_URL },
  ];
}
