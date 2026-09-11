/**
 * Client du compte headless — parle à /site-api/kinkyx/v1 (proxy vers le
 * mu-plugin kinkyx-account-api). Session gérée par un cookie HttpOnly côté
 * serveur (kx_session) : rien à stocker ici, juste `credentials: "include"`.
 */

const API = "/site-api/kinkyx/v1";

export type ApiError = { code: string; message: string; status: number };

export type Order = {
  id: number;
  number: string;
  date: string | null;
  status: string;
  status_label: string;
  total: string;
  currency: string;
  items_count: number;
};

export type OrderDetail = Order & {
  items: { name: string; quantity: number; total: string; product_id: number; variation_id: number; image: string }[];
  shipping_total: string;
  shipping_method: string;
  parcel_point: { name: string; address: string; zipcode: string; city: string } | null;
  payment_method_title: string;
  billing: AddressFields;
  shipping_address: AddressFields;
  customer_note: string;
};

export type AddressFields = {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
};

export type Addresses = {
  billing: AddressFields & { email: string };
  shipping: AddressFields;
};

export type Me = { id: number; email: string; first_name: string; last_name: string };

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...init,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err: ApiError = {
      code: data?.code || "unknown_error",
      message: data?.message || `Erreur ${res.status}`,
      status: res.status,
    };
    throw err;
  }
  return data as T;
}

export const register = (p: { email: string; password: string; first_name: string; last_name: string; hp?: string }) =>
  call<{ ok: true }>("/auth/register", { method: "POST", body: JSON.stringify(p) });

export const login = (p: { login: string; password: string }) =>
  call<{ ok: true }>("/auth/login", { method: "POST", body: JSON.stringify(p) });

export const logout = () => call<{ ok: true }>("/auth/logout", { method: "POST" });

export const forgotPassword = (login: string) =>
  call<{ ok: true }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ login }) });

export const resetPassword = (p: { login: string; key: string; password: string }) =>
  call<{ ok: true }>("/auth/reset-password", { method: "POST", body: JSON.stringify(p) });

export const getMe = () => call<Me>("/account/me");

export const updateMe = (p: Partial<Me> & { current_password?: string; new_password?: string }) =>
  call<{ ok: true }>("/account/update-me", { method: "POST", body: JSON.stringify(p) });

export const listOrders = () => call<Order[]>("/account/orders");

export const getOrder = (id: number | string) => call<OrderDetail>(`/account/orders/${id}`);

export const getAddresses = () => call<Addresses>("/account/addresses");

export const updateAddresses = (p: { billing: Partial<Addresses["billing"]>; shipping: Partial<AddressFields> }) =>
  call<{ ok: true }>("/account/update-addresses", { method: "POST", body: JSON.stringify(p) });

/** true si connecté (léger appel /account/me, utilisé pour aiguiller l'affichage). */
export async function isLoggedIn(): Promise<Me | null> {
  try {
    return await getMe();
  } catch {
    return null;
  }
}
