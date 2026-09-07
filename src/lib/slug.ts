const DE: Record<string, string> = {
  ä: "ae", ö: "oe", ü: "ue", ß: "ss", Ä: "ae", Ö: "oe", Ü: "ue",
};

/** Slug URL propre, avec translittération allemande (ß→ss, ö→oe…). */
export function slugify(input: string | null | undefined): string {
  return String(input ?? "")
    .replace(/[äöüßÄÖÜ]/g, (c) => DE[c] ?? c)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/["'’]/g, "")
    .replace(/&/g, " et ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
