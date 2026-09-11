/**
 * Orchestration du paiement Stripe pour le checkout headless (Phase 1 / P1-C).
 *
 * Flux : Stripe Elements (Card Element) crée un PaymentMethod côté
 * navigateur -> on l'envoie à l'API Store (`payment_data: [{key:
 * "wc-stripe-payment-method", value: pm_xxx}]`, format trouvé en lisant le
 * code du plugin WooCommerce Stripe Gateway — pas d'API publique dédiée).
 * WooCommerce/Stripe créent et tentent de confirmer le paiement côté
 * serveur ; si une authentification forte (3-D Secure) est nécessaire, la
 * réponse porte un fragment `#wc-stripe-confirm-pi:{orderId}:{clientSecret}:
 * {token}` qu'on complète avec `stripe.confirmCardPayment()` (Stripe.js
 * standard, documenté). La confirmation finale de la commande est laissée
 * au webhook Stripe (source de vérité) : on se contente d'attendre que son
 * statut change via /order-status.
 */

import { checkout as apiCheckout, type Address, type CheckoutResponse } from "./cart";

const STRIPE_JS_SRC = "https://js.stripe.com/v3/";

let stripePromise: Promise<any> | null = null;
function loadStripeJs(): Promise<any> {
  if ((window as any).Stripe) return Promise.resolve((window as any).Stripe);
  if (stripePromise) return stripePromise;
  stripePromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = STRIPE_JS_SRC;
    s.onload = () => resolve((window as any).Stripe);
    s.onerror = () => reject(new Error("Stripe.js n'a pas pu être chargé."));
    document.head.appendChild(s);
  });
  return stripePromise;
}

export type StripeCardMount = {
  stripe: any;
  card: any;
};

/** Charge Stripe.js, crée l'instance et monte le Card Element dans `el`. */
export async function mountCard(el: HTMLElement, publishableKey: string): Promise<StripeCardMount> {
  const Stripe = await loadStripeJs();
  const stripe = Stripe(publishableKey);
  const elements = stripe.elements();
  const card = elements.create("card", {
    style: { base: { fontSize: "15px", fontFamily: '"Quattrocento Sans", sans-serif' } },
  });
  card.mount(el);
  return { stripe, card };
}

async function pollOrderStatus(orderId: number, orderKey: string, timeoutMs = 20000): Promise<string> {
  const started = Date.now();
  let status = "pending";
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(
        `/site-api/kinkyx/v1/order-status?id=${orderId}&key=${encodeURIComponent(orderKey)}`,
      );
      if (res.ok) {
        const data = await res.json();
        status = data.status;
        if (status !== "pending" && status !== "on-hold") return status;
      }
    } catch {
      /* on retente */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return status;
}

export type PlaceOrderResult =
  | { ok: true; orderId: number; orderKey: string }
  | { ok: false; error: string };

/**
 * Crée le PaymentMethod, passe la commande, et gère la 3-D Secure si besoin.
 */
export async function placeOrder(
  mount: StripeCardMount,
  billing: Address,
  shipping: Address,
  customerNote: string,
  on3ds: () => void,
): Promise<PlaceOrderResult> {
  const { stripe, card } = mount;

  const pmResult = await stripe.createPaymentMethod({
    type: "card",
    card,
    billing_details: {
      name: `${billing.first_name} ${billing.last_name}`.trim(),
      email: billing.email,
      phone: billing.phone,
      address: {
        line1: billing.address_1,
        line2: billing.address_2,
        city: billing.city,
        postal_code: billing.postcode,
        country: billing.country,
      },
    },
  });
  if (pmResult.error) {
    return { ok: false, error: pmResult.error.message || "Carte refusée." };
  }

  let res: CheckoutResponse;
  try {
    res = await apiCheckout({
      billing,
      shipping,
      paymentMethod: "stripe",
      paymentData: [{ key: "wc-stripe-payment-method", value: pmResult.paymentMethod.id }],
      customerNote,
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const redirect =
    res.payment_result?.payment_details?.find((d) => d.key === "redirect")?.value ||
    res.payment_result?.redirect_url ||
    "";

  if (redirect.startsWith("#wc-stripe-confirm-pi:")) {
    on3ds();
    const parts = redirect.split(":");
    const clientSecret = parts[2];
    const confirm = await stripe.confirmCardPayment(clientSecret);
    if (confirm.error) {
      return { ok: false, error: confirm.error.message || "La vérification a échoué." };
    }
    const finalStatus = await pollOrderStatus(res.order_id, res.order_key);
    if (finalStatus === "failed" || finalStatus === "cancelled") {
      return { ok: false, error: "Le paiement n'a pas abouti." };
    }
    return { ok: true, orderId: res.order_id, orderKey: res.order_key };
  }

  return { ok: true, orderId: res.order_id, orderKey: res.order_key };
}
