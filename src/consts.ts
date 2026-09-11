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
 * Suivi. Chargé UNIQUEMENT après consentement (voir scripts/consent.ts).
 * Un ID vide = script non chargé.
 *  - analytics : mesure d'audience (GA4)
 *  - ads       : publicité (Pixel Meta, Pixel TikTok)
 */
export const ANALYTICS = {
  ga4: "G-L38H6BSKBP",
  metaPixel: "1730714131633448",
  tiktokPixel: "",
} as const;
