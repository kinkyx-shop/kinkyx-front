import type { Locale } from "@/i18n/ui";
import { ui } from "@/i18n/ui";
import { SITE, ACCOUNT_URL } from "@/consts";
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

/** Menu principal : 2 univers catalogue + Sur-mesure + Infos. */
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

  const infoChildren = [
    pageLink("atelier", locale, "atelier", "Atelier"),
    pageLink("guide-des-tailles", locale, "guide-des-tailles", "Guide des tailles"),
    pageLink("revendeur", locale, "revendeur", "Revendeurs"),
    pageLink("shooting", locale, "shooting", "Shooting"),
  ];

  return [
    ...catNodes,
    { label: bespoke.label, href: bespoke.href, children: [] },
    { label: T(locale, "nav.info"), href: infoChildren[0].href, children: infoChildren },
  ];
}

/** Liens du pied de page « service client ». */
export function footerLinks(locale: Locale) {
  // CGV/CGU : rendues par un template Elementor côté WordPress (pas de contenu
  // exploitable via l'API) → on pointe vers le back tant qu'elles ne sont pas
  // réécrites en contenu propre (voir L6).
  const legal = SITE.checkoutUrl.replace(/\/+$/, "");
  return [
    pageLink("livraison-retour", locale, "livraison-retour", T(locale, "footer.delivery")),
    { label: T(locale, "footer.terms"), href: `${legal}/cgv/` },
    { label: T(locale, "footer.termsUse"), href: `${legal}/cgu/` },
    { label: T(locale, "nav.account"), href: ACCOUNT_URL },
  ];
}
