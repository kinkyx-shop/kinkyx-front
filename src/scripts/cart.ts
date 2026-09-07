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

type CartResponse = {
  items_count?: number;
  items?: unknown[];
  totals?: { total_price?: string; currency_minor_unit?: number };
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

// au chargement : synchronise le badge sans bloquer le rendu
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    refresh().catch(() => {
      /* pas de panier encore */
    });
  });
}
