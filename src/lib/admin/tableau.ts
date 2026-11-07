// Tri, filtres et pagination des tableaux admin, portés par l'adresse (?tri=…&ordre=…&page=…).

export type Params = Record<string, string | string[] | undefined>;

export const PAR_PAGE = 25;

export function valeur(params: Params, cle: string): string {
  const v = params[cle];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export function lirePage(params: Params) {
  const page = Math.max(1, Number.parseInt(valeur(params, "page"), 10) || 1);
  return { page, debut: (page - 1) * PAR_PAGE, fin: page * PAR_PAGE - 1 };
}

// Tri limité aux colonnes autorisées (jamais une colonne choisie librement dans l'adresse)
export function lireTri<T extends string>(params: Params, autorises: readonly T[], parDefaut: T, ordreParDefaut: "asc" | "desc" = "desc") {
  const tri = valeur(params, "tri") as T;
  const ordre = valeur(params, "ordre");
  return {
    tri: autorises.includes(tri) ? tri : parDefaut,
    croissant: ordre === "asc" ? true : ordre === "desc" ? false : ordreParDefaut === "asc",
  };
}

// Adresse de la page avec certains paramètres changés (null = retiré)
export function lienAvec(chemin: string, params: Params, changements: Record<string, string | null>) {
  const p = new URLSearchParams();
  for (const [cle, v] of Object.entries(params)) {
    const x = Array.isArray(v) ? v[0] : v;
    if (x) p.set(cle, x);
  }
  for (const [cle, v] of Object.entries(changements)) {
    if (v === null || v === "") p.delete(cle);
    else p.set(cle, v);
  }
  const q = p.toString();
  return q ? `${chemin}?${q}` : chemin;
}

// Échappe % et _ pour une recherche ILIKE
export function motifRecherche(texte: string) {
  return `%${texte.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
