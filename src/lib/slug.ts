const DE: Record<string, string> = {
  ä: "ae", ö: "oe", ü: "ue", ß: "ss", Ä: "ae", Ö: "oe", Ü: "ue",
};

/** Décode les entités HTML fréquentes (« &#038; » → « & »). */
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

/** Slug URL propre : entités décodées, translittération allemande (ß→ss…), « & » supprimé. */
export function slugify(input: string | null | undefined): string {
  return decodeEntities(String(input ?? ""))
    .replace(/[äöüßÄÖÜ]/g, (c) => DE[c] ?? c)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/["'’]/g, "")
    .replace(/&/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
