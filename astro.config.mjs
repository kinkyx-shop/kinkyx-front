// @ts-check
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";
import sitemap from "@astrojs/sitemap";

const env = loadEnv(process.env.NODE_ENV || "production", process.cwd(), "");
const site = env.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || "https://www.kinkyx-shop.com";

// Front statique multilingue. FR à la racine, /en/ et /de/ préfixés.
export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  i18n: {
    defaultLocale: "fr",
    locales: ["fr", "en", "de"],
    routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: "fr",
        locales: { fr: "fr-FR", en: "en-GB", de: "de-DE" },
      },
      // "mon-compte" etc. sans ancre de fin : exclut aussi les sous-pages
      // (mon-compte/commandes/, mon-compte/adresses/…) — toutes noindex.
      filter: (page) =>
        !/\/(panier|cart|warenkorb|commande|checkout|kasse|mon-compte|my-account|mein-konto|recherche|search|suche|favoris|favorites|merkliste)(\/|$)/.test(page),
    }),
  ],
  image: {
    domains: ["www.kinkyx-shop.com", "dev.kinkyx-shop.com", "back.kinkyx-shop.com", "8d927e44.delivery.rocketcdn.me"],
  },
});
