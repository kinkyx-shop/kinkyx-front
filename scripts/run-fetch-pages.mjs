/**
 * Rafraîchit uniquement data/pages.json (pages de contenu WordPress/Elementor),
 * sans re-tirer tout le catalogue.
 *
 *   npm run fetch:pages
 *
 * Utile quand seul le contenu éditorial a changé ; `npm run build` fait tout.
 */
import { fetchPages } from "./fetch-pages.mjs";

try {
  await fetchPages();
} catch (e) {
  console.error("fetch:pages a échoué :", e?.message || e);
  process.exit(1);
}
