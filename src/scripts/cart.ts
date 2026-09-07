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
  totals?: { line_total?: string; currency_minor_unit?: number };
};

export type CartResponse = {
  items_count?: number;
  items?: CartItem[];
  totals?: {
    total_items?: string;
    total_price?: string;
    currency_minor_unit?: number;
    currency_symbol?: string;
    currency_code?: string;
  };
  errors?: { code: string; message: string }[];
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

async function req(path: string, init: RequestInit = {}): Promise<CartResponse> {
  const res = await fetch(`${STORE}${path}`, { ...init, headers: headers(init.headers as Record<string, string>) });
  capture(res);
  const data = (await res.json().catch(() => ({}))) as CartResponse;
  if (!res.ok) {
    const msg = data?.errors?.[0]?.message || `Erreur ${res.status}`;
    throw new Error(msg);
  }
  return data;
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

/**
 * URL de bascule vers le tunnel WooCommerce, avec le panier encodé.
 * Le back charge le panier en session puis redirige vers /commande.
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

// au chargement : synchronise le badge sans bloquer le rendu
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    refresh().catch(() => {
      /* pas de panier encore */
    });
  });
}
