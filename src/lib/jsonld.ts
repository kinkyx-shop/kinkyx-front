import { SITE } from "@/consts";
import { routePath } from "@/i18n/utils";
import type { Locale } from "@/i18n/ui";

const abs = (path: string) => new URL(path, SITE.url).href;

/** Fil d'ariane structuré. `items` = du plus général au plus précis, chemins absolus ou relatifs. */
export function breadcrumbList(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

export function organization() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    email: SITE.email,
    logo: abs("/favicon.svg"),
    sameAs: [SITE.social.instagram, SITE.social.facebook],
  };
}

export function website(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: abs(routePath("search", locale)) + "?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };
}
