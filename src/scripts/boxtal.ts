/**
 * Sélection du point relais Boxtal au checkout.
 *
 * Notre panier n'a pas de cookie de session (Cart-Token uniquement, voir
 * cart.ts), donc on ne peut pas utiliser les endpoints admin-ajax natifs du
 * plugin Boxtal Connect (dépendants du cookie WooCommerce classique). On
 * passe par deux routes maison (mu-plugin kinkyx-boxtal.php, hors dépôt —
 * voir CUTOVER.md) qui lisent/écrivent directement la session WooCommerce
 * du client, identifié par son Cart-Token.
 */

const K_TOKEN = "kx_cart_token";

export type ParcelPoint = {
  network: string;
  code: string;
  name: string;
  address: string;
  zipcode: string;
  city: string;
  country: string;
  openingHours?: unknown;
  distance?: number | null;
};

export type Address = {
  address_1?: string;
  address_2?: string;
  city?: string;
  postcode?: string;
  country?: string;
};

function cartToken(): string {
  try {
    return localStorage.getItem(K_TOKEN) || "";
  } catch {
    return "";
  }
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`/site-api/kinkyx/v1${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// L'API Boxtal encapsule chaque point sous une forme légèrement différente
// selon le contexte (retour brut de leur API vs. relecture interne du
// plugin) — on accepte les deux plutôt que de figer une seule forme.
function normalizePoint(raw: any): ParcelPoint | null {
  const p = raw?.parcelPoint ?? raw;
  if (!p?.network || !p?.code) return null;
  const loc = p.location ?? {};
  return {
    network: p.network,
    code: p.code,
    name: p.name ?? "",
    address: p.address ?? loc.street ?? "",
    zipcode: p.zipcode ?? loc.zipCode ?? "",
    city: p.city ?? loc.city ?? "",
    country: p.country ?? loc.country ?? "",
    openingHours: p.openingHours ?? p.openingDays ?? null,
    distance: raw?.distance ?? raw?.distanceFromSearchLocation ?? p.distance ?? null,
  };
}

/** Liste les points relais proches, pour un mode de livraison Boxtal donné (ex. "boxtal_connect:1"). */
export async function listParcelPoints(carrier: string, address: Address): Promise<ParcelPoint[] | null> {
  const result = await post<{ nearbyParcelPoints?: unknown[] }>("/boxtal/points", {
    cart_token: cartToken(),
    carrier,
    address,
  });
  const raw = result?.nearbyParcelPoints;
  if (!Array.isArray(raw)) return null;
  return raw.map(normalizePoint).filter((p): p is ParcelPoint => p !== null);
}

/** Enregistre le point choisi ; l'accroche à la commande est faite par Boxtal lui-même au moment du paiement. */
export async function chooseParcelPoint(carrier: string, point: ParcelPoint): Promise<boolean> {
  const result = await post<{ ok?: boolean }>("/boxtal/point", { cart_token: cartToken(), carrier, point });
  return !!result?.ok;
}
