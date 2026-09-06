// @ts-check
import { defineConfig } from "astro/config";

// Front statique multilingue. FR à la racine, /en/ et /de/ préfixés.
export default defineConfig({
  site: "https://www.kinkyx-shop.com",
  output: "static",
  trailingSlash: "always",
  build: {
    format: "directory",
  },
  i18n: {
    defaultLocale: "fr",
    locales: ["fr", "en", "de"],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  image: {
    // Domaines autorisés pour l'optimisation d'images distantes (backend WooCommerce).
    domains: ["www.kinkyx-shop.com", "dev.kinkyx-shop.com", "8d927e44.delivery.rocketcdn.me"],
  },
});
