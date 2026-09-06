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

/** Endpoint public Store API (panier/stock/recherche côté navigateur). */
export const STORE_API = `${SITE.checkoutUrl}/wp-json/wc/store/v1`;

/**
 * Arborescence de navigation principale.
 * Les `slug` sont des chemins SANS préfixe de langue ; ils seront localisés
 * à l'affichage. Les slugs traduits par langue seront injectés au lot 1
 * depuis le mapping de catégories WooCommerce.
 */
export type NavNode = {
  key: string;
  slug: string;
  children?: NavNode[];
};

export const NAV: NavNode[] = [
  {
    key: "nav.latex",
    slug: "/latex/",
    children: [
      { key: "Femme", slug: "/latex/femme/" },
      { key: "Homme", slug: "/latex/homme/" },
      { key: "Accessoires", slug: "/latex/accessoires/" },
      { key: "Express", slug: "/latex/express/" },
      { key: "Soins du latex", slug: "/latex/soins-du-latex/" },
    ],
  },
  {
    key: "nav.shoes",
    slug: "/chaussures/",
    children: [
      { key: "Bottes", slug: "/chaussures/modele/botte/" },
      { key: "Bottines", slug: "/chaussures/modele/bottine/" },
      { key: "Cuissardes", slug: "/chaussures/modele/cuissarde/" },
      { key: "Escarpins", slug: "/chaussures/modele/escarpin/" },
      { key: "Mules", slug: "/chaussures/modele/mule/" },
      { key: "Sandales", slug: "/chaussures/modele/sandale/" },
    ],
  },
  { key: "nav.bespoke", slug: "/latex-sur-mesure/" },
  {
    key: "nav.info",
    slug: "/infos/",
    children: [
      { key: "L'atelier", slug: "/atelier/" },
      { key: "Guide des tailles", slug: "/guide-des-tailles/" },
      { key: "Revendeurs", slug: "/revendeur/" },
      { key: "Shooting", slug: "/shooting/" },
    ],
  },
];
