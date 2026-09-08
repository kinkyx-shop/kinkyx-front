/**
 * Consentement cookies + chargement conditionnel des traceurs.
 *  - Rien n'est chargé tant que l'utilisateur n'a pas choisi.
 *  - Choix mémorisé dans localStorage (kx_consent).
 *  - GA4 (analytics) et Pixels Meta/TikTok (ads) chargés seulement si accordé.
 *
 * La bannière (markup) vit dans ConsentBanner.astro. Ici : l'état + les loaders.
 */
import { ANALYTICS } from "@/consts";

type Consent = { analytics: boolean; ads: boolean; ts: number };
const KEY = "kx_consent";

// pas de traceurs sur la préprod (PUBLIC_NOINDEX) — évite de polluer GA/Meta
const TRACKING_ON =
  import.meta.env.PUBLIC_NOINDEX !== "1" && import.meta.env.PUBLIC_NOINDEX !== "true";

function read(): Consent | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v === "object" && "analytics" in v && "ads" in v) return v as Consent;
  } catch {
    /* ignore */
  }
  return null;
}

function write(c: Consent) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

/* ---------------- loaders (idempotents) ---------------- */
let gaLoaded = false;
let adsLoaded = false;

function loadGA() {
  if (gaLoaded || !ANALYTICS.ga4) return;
  gaLoaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS.ga4}`;
  document.head.appendChild(s);
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () {
    w.dataLayer.push(arguments);
  };
  w.gtag("js", new Date());
  w.gtag("config", ANALYTICS.ga4, { anonymize_ip: true });
}

function loadAds() {
  if (adsLoaded) return;
  adsLoaded = true;
  const w = window as any;

  if (ANALYTICS.metaPixel) {
    /* eslint-disable */
    !(function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(w, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    w.fbq("init", ANALYTICS.metaPixel);
    w.fbq("track", "PageView");
    /* eslint-enable */
  }

  if (ANALYTICS.tiktokPixel) {
    /* eslint-disable */
    !(function (w: any, d: any, t: any) {
      w.TiktokAnalyticsObject = t;
      const ttq = (w[t] = w[t] || []);
      ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
      ttq.setAndDefer = function (obj: any, m: string) {
        obj[m] = function () {
          obj.push([m].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (id: string) {
        const e = ttq._i[id] || [];
        for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
        return e;
      };
      ttq.load = function (id: string) {
        ttq._i = ttq._i || {};
        ttq._i[id] = [];
        ttq._i[id]._u = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._t = ttq._t || {};
        ttq._t[id] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[id] = {};
        const s = d.createElement("script");
        s.type = "text/javascript";
        s.async = !0;
        s.src = ttq._i[id]._u + "?sdkid=" + id + "&lib=" + t;
        const f = d.getElementsByTagName("script")[0];
        f.parentNode!.insertBefore(s, f);
      };
      ttq.load(ANALYTICS.tiktokPixel);
      ttq.page();
    })(w, document, "ttq");
    /* eslint-enable */
  }
}

function apply(c: Consent) {
  if (!TRACKING_ON) return;
  if (c.analytics) loadGA();
  if (c.ads) loadAds();
}

/* ---------------- API pour la bannière ---------------- */
declare global {
  interface Window {
    kxConsent: {
      get(): Consent | null;
      set(analytics: boolean, ads: boolean): void;
      open(): void;
    };
  }
}

function setConsent(analytics: boolean, ads: boolean) {
  const c: Consent = { analytics, ads, ts: Date.now() };
  write(c);
  apply(c);
  document.documentElement.classList.remove("kx-consent-open");
  document.dispatchEvent(new CustomEvent("kx:consent", { detail: c }));
}

window.kxConsent = {
  get: read,
  set: setConsent,
  open() {
    document.documentElement.classList.add("kx-consent-open");
  },
};

/* ---------------- init ---------------- */
if (typeof document !== "undefined") {
  const existing = read();
  if (existing) apply(existing);
  else document.documentElement.classList.add("kx-consent-open");

  document.addEventListener("click", (e) => {
    if ((e.target as HTMLElement)?.closest("[data-consent-open]")) {
      window.kxConsent.open();
    }
  });
}
