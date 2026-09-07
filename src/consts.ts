/** Config statique du site. */

export const SITE = {
  name: "Kinkyx",
  url: import.meta.env.PUBLIC_SITE_URL ?? "https://www.kinkyx-shop.com",
  checkoutUrl: import.meta.env.PUBLIC_CHECKOUT_URL ?? "https://back.kinkyx-shop.com",
  email: "info@kinkyx-shop.com",
  social: {
    instagram: "https://www.instagram.com/kinkyx_shop/",
    facebook: "https://www.facebook.com/kinkyxshop/",
  },
} as const;

/** Endpoint public Store API (panier / stock / recherche côté navigateur). */
export const STORE_API = `${SITE.checkoutUrl}/wp-json/wc/store/v1`;

/**
 * Espace client : géré par WooCommerce sur le back (connexion, commandes,
 * adresses, téléchargements). Pas de réécriture headless — lien sortant.
 */
export const ACCOUNT_URL = `${SITE.checkoutUrl.replace(/\/+$/, "")}/mon-compte/`;
