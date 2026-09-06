import { ui, defaultLocale, locales, type Locale, type UIKey } from "./ui";

/** Locale déduite d'une URL ("/en/…" -> "en", sinon "fr"). */
export function getLocale(url: URL): Locale {
  const seg = url.pathname.split("/").filter(Boolean)[0];
  return (locales as readonly string[]).includes(seg) ? (seg as Locale) : defaultLocale;
}

/** Fonction de traduction pour une locale donnée. */
export function useTranslations(locale: Locale) {
  return function t(key: UIKey): string {
    return ui[locale][key] ?? ui[defaultLocale][key] ?? key;
  };
}

/** Préfixe une route interne avec la locale ("/boutique/" -> "/en/boutique/"). */
export function localizedPath(path: string, locale: Locale): string {
  const clean = "/" + path.replace(/^\/+/, "");
  if (locale === defaultLocale) return withTrailingSlash(clean);
  return withTrailingSlash(`/${locale}${clean}`);
}

/** Enlève le préfixe de locale d'un chemin ("/en/boutique/" -> "/boutique/"). */
export function stripLocale(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if ((locales as readonly string[]).includes(parts[0])) parts.shift();
  return withTrailingSlash("/" + parts.join("/"));
}

/** Toutes les variantes de langue d'un chemin sans préfixe (pour hreflang). */
export function alternates(pathNoLocale: string): { locale: Locale; path: string }[] {
  return locales.map((locale) => ({ locale, path: localizedPath(pathNoLocale, locale) }));
}

function withTrailingSlash(p: string): string {
  if (p === "/") return p;
  return p.endsWith("/") ? p : p + "/";
}
