// Catégories des marchés et couleurs de leurs étiquettes (DESIGN.md).

export const CATEGORIES = ["football", "musique", "politique", "vie_quotidienne"] as const;
export type Categorie = (typeof CATEGORIES)[number];

export const LIBELLES_CATEGORIES: Record<Categorie, string> = {
  football: "Football",
  musique: "Musique",
  politique: "Politique",
  vie_quotidienne: "Vie quotidienne",
};

// Classes Tailwind de l'étiquette (fond + texte)
export const STYLES_CATEGORIES: Record<Categorie, string> = {
  football: "bg-cat-football-fond text-cat-football-texte",
  musique: "bg-cat-musique-fond text-cat-musique-texte",
  politique: "bg-cat-politique-fond text-cat-politique-texte",
  vie_quotidienne: "bg-cat-vie-fond text-cat-vie-texte",
};

// Point de couleur dans le bandeau défilant
export const POINTS_CATEGORIES: Record<Categorie, string> = {
  football: "bg-sauge",
  musique: "bg-brique",
  politique: "bg-vert-jaune",
  vie_quotidienne: "bg-white",
};

export function estCategorie(v: string): v is Categorie {
  return (CATEGORIES as readonly string[]).includes(v);
}
