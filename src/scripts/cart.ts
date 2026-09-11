/**
 * Panier côté navigateur — parle au proxy /store-api (même origine),
 * qui relaie vers la Store API WooCommerce.
 *
 * Persistance : Cart-Token + Nonce dans localStorage (panier invité,
 * inter-domaines, sans cookie).
 */

const STORE = "/store-api";
const K_TOKEN = "kx_cart_token";
const K_NONCE = "kx_cart_nonce";

export type CartItem = {
  key: string;
  id: number;
  quantity: number;
  name: string;
  short_description?: string;
  permalink?: string;
  images?: { thumbnail?: string; src?: string }[];
  variation?: { attribute: string; value: string }[];
  prices?: {
    price?: string;
    regular_price?: string;
    currency_minor_unit?: number;
    currency_symbol?: string;
  };
  totals?: { line_total?: string; line_total_tax?: string; currency_minor_unit?: number };
};

export type ShippingRate = {
  rate_id: string;
  name: string;
  description?: string;
  price: string;
  selected: boolean;
  meta_data?: { key: string; value: string }[];
};
export type ShippingPackage = { package_id: number | string; shipping_rates: ShippingRate[] };

export type Address = {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state?: string;
  postcode: string;
  country: string;
  phone?: string;
  email?: string;
};

export type CartResponse = {
  items_count?: number;
  items?: CartItem[];
  shipping_rates?: ShippingPackage[];
  totals?: {
    total_items?: string;
    total_price?: string;
    total_shipping?: string;
    currency_minor_unit?: number;
    currency_symbol?: string;
    currency_code?: string;
  };
  errors?: { code: string; message: string }[];
};

export type CheckoutResponse = {
  order_id: number;
  order_key: string;
  status: string;
  payment_method?: string;
  payment_result?: {
    payment_status: string;
    redirect_url: string;
    payment_details?: { key: string; value: string }[];
  };
};

function ls(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function setLs(key: string, val: string) {
  try {
    localStorage.setItem(key, val);
  } catch {
    /* mode privé */
  }
}

function headers(extra: Record<string, string> = {}): HeadersInit {
  const h: Record<string, string> = { "content-type": "application/json", ...extra };
  const tok = ls(K_TOKEN);
  const nonce = ls(K_NONCE);
  if (tok) h["Cart-Token"] = tok;
  if (nonce) h["Nonce"] = nonce;
  return h;
}

function capture(res: Response) {
  const tok = res.headers.get("cart-token") || res.headers.get("Cart-Token");
  const nonce = res.headers.get("nonce") || res.headers.get("Nonce");
  if (tok) setLs(K_TOKEN, tok);
  if (nonce) setLs(K_NONCE, nonce);
}

async function req<T = CartResponse>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${STORE}${path}`, { ...init, headers: headers(init.headers as Record<string, string>) });
  capture(res);
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    // deux formes d'erreur possibles côté API Store : {message} (WP_Error)
    // ou {errors:[{message}]} (notices de panier remontées avec un statut KO)
    const msg = data?.message || data?.errors?.[0]?.message || `Erreur ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

/** État courant (rafraîchi à chaque appel). */
export const cart = {
  count: 0,
};

function announce(data: CartResponse) {
  cart.count = data.items_count ?? cart.count;
  document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((el) => {
    el.textContent = String(cart.count);
    el.hidden = cart.count === 0;
  });
  document.dispatchEvent(new CustomEvent("kx:cart", { detail: data }));
}

export async function refresh(): Promise<CartResponse> {
  const data = await req("/cart", { method: "GET" });
  announce(data);
  return data;
}

export async function addItem(
  id: number,
  quantity = 1,
  variation?: { attribute: string; value: string }[],
): Promise<CartResponse> {
  const body: Record<string, unknown> = { id, quantity };
  if (variation && variation.length) body.variation = variation;
  const data = await req("/cart/add-item", { method: "POST", body: JSON.stringify(body) });
  announce(data);
  return data;
}

export async function setQuantity(key: string, quantity: number): Promise<CartResponse> {
  const data = await req("/cart/update-item", {
    method: "POST",
    body: JSON.stringify({ key, quantity }),
  });
  announce(data);
  return data;
}

export async function removeItem(key: string): Promise<CartResponse> {
  const data = await req("/cart/remove-item", { method: "POST", body: JSON.stringify({ key }) });
  announce(data);
  return data;
}

/** Renseigne l'adresse de facturation/livraison — fait apparaître les frais de port. */
export async function updateCustomer(billing: Address, shipping: Address): Promise<CartResponse> {
  const data = await req<CartResponse>("/cart/update-customer", {
    method: "POST",
    body: JSON.stringify({ billing_address: billing, shipping_address: shipping }),
  });
  announce(data);
  return data;
}

export async function selectShippingRate(packageId: number | string, rateId: string): Promise<CartResponse> {
  const data = await req<CartResponse>("/cart/select-shipping-rate", {
    method: "POST",
    body: JSON.stringify({ package_id: packageId, rate_id: rateId }),
  });
  announce(data);
  return data;
}

/**
 * Passe la commande. `paymentData` : paires clé/valeur attendues par la
 * passerelle choisie (pour Stripe : `wc-stripe-payment-method` -> id `pm_…`
 * créé côté navigateur par Stripe.js).
 */
export async function checkout(p: {
  billing: Address;
  shipping: Address;
  paymentMethod: string;
  paymentData?: { key: string; value: string }[];
  customerNote?: string;
}): Promise<CheckoutResponse> {
  const data = await req<CheckoutResponse>("/checkout", {
    method: "POST",
    body: JSON.stringify({
      billing_address: p.billing,
      shipping_address: p.shipping,
      payment_method: p.paymentMethod,
      payment_data: p.paymentData ?? [],
      customer_note: p.customerNote ?? "",
    }),
  });
  // la commande est passée : le panier headless est vidé pour cette session
  cart.count = 0;
  document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((el) => {
    el.textContent = "0";
    el.hidden = true;
  });
  return data;
}

/**
 * URL de bascule vers le tunnel WooCommerce, avec le panier encodé.
 * Le back charge le panier en session puis redirige vers /commande.
 * @deprecated remplacé par le checkout headless (P1-C) — gardé le temps de
 * retirer kinkyx-handoff.php côté back (P1-E).
 */
export function handoffUrl(items: CartItem[], locale: string): string {
  const base = (
    (typeof import.meta !== "undefined" && (import.meta as any).env?.PUBLIC_CHECKOUT_URL) ||
    "https://dev.kinkyx-shop.com"
  ).replace(/\/+$/, "");
  const payload = items.map((it) => ({
    id: it.id,
    quantity: it.quantity,
    variation: it.variation ?? [],
  }));
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return `${base}/?kx_handoff=1&lang=${encodeURIComponent(locale)}&items=${encodeURIComponent(b64)}`;
}

/** Format d'un montant depuis les "minor units" de la Store API (ex. "12000", 2 → "120,00 €"). */
export function money(minor: string | number | undefined, unit = 2, symbol = "€"): string {
  const n = Number(minor ?? 0) / Math.pow(10, unit);
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${symbol}`;
}

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£", CHF: "CHF" };

/**
 * Même rendu que `money()`, mais depuis un montant décimal + un code devise
 * (ce que renvoient les commandes WooCommerce classiques — /account/orders,
 * /order-status — à la différence du panier qui parle en "minor units").
 */
export function moneyFromDecimal(amount: string | number | undefined, currencyCode = "EUR"): string {
  const n = Number(amount ?? 0);
  const symbol = CURRENCY_SYMBOLS[currencyCode] ?? currencyCode;
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${symbol}`;
}

// au chargement : synchronise le badge sans bloquer le rendu
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    refresh().catch(() => {
      /* pas de panier encore */
    });
  });
}
