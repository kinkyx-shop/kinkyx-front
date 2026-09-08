/**
 * Liste de souhaits — 100 % navigateur (localStorage), sans compte.
 * Stocke un tableau de clés produit (id FR). Émet `kx:wishlist` à chaque
 * changement et met à jour les badges [data-wishlist-count] + les cœurs
 * [data-wish-toggle].
 */

const KEY = "kx_wishlist";

function read(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function write(list: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota / mode privé : on ignore */
  }
}

export function list(): number[] {
  return read();
}

export function has(key: number): boolean {
  return read().includes(key);
}

export function count(): number {
  return read().length;
}

export function toggle(key: number): boolean {
  const cur = read();
  const i = cur.indexOf(key);
  if (i >= 0) cur.splice(i, 1);
  else cur.unshift(key);
  write(cur);
  sync();
  return i < 0; // true = ajouté
}

function sync() {
  const cur = read();
  const n = cur.length;
  document.querySelectorAll<HTMLElement>("[data-wishlist-count]").forEach((el) => {
    el.textContent = String(n);
    el.hidden = n === 0;
  });
  document.querySelectorAll<HTMLElement>("[data-wish-toggle]").forEach((el) => {
    const k = Number(el.dataset.key);
    const on = cur.includes(k);
    el.setAttribute("aria-pressed", String(on));
    el.classList.toggle("is-on", on);
  });
  document.dispatchEvent(new CustomEvent("kx:wishlist", { detail: cur }));
}

function init() {
  document.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement)?.closest<HTMLElement>("[data-wish-toggle]");
    if (!btn) return;
    e.preventDefault();
    const k = Number(btn.dataset.key);
    if (k) toggle(k);
  });
  // autre onglet
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) sync();
  });
  sync();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
