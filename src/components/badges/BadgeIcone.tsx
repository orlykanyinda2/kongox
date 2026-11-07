// Dessin d'un badge : une médaille couleur bronze, argent ou or, avec un pictogramme simple (pas d'emoji).
// Composant sans état, utilisable côté serveur et navigateur.

export type Niveau = "bronze" | "argent" | "or";

export const COULEURS_NIVEAU: Record<Niveau, { fond: string; bord: string; libelle: string }> = {
  bronze: { fond: "#D9965B", bord: "#8C5A2E", libelle: "Bronze" },
  argent: { fond: "#C9D1D6", bord: "#6F7B83", libelle: "Argent" },
  or: { fond: "#E9C46A", bord: "#A8801F", libelle: "Or" },
};

// Pictogrammes (viewBox 24 × 24, trait vert forêt)
const GLYPHES: Record<string, React.ReactNode> = {
  etoile: <path d="M12 4l2.4 5 5.4.7-4 3.7 1 5.3L12 16l-4.8 2.7 1-5.3-4-3.7 5.4-.7z" />,
  flamme: <path d="M12 3c1.5 3.5 6 5.5 6 10.5a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 .8 3.2 2 3.6-.4-3 0-5.6 1-8.1z" />,
  cible: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  cerveau: <path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.3A3 3 0 0 0 7 18a3 3 0 0 0 5 1V5.5A3 3 0 0 0 9 4.5zM15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.3A3 3 0 0 1 17 18a3 3 0 0 1-5 1" />,
  plume: <path d="M19 4c-6 0-11 4.5-12 11l-2 5M19 4c0 7-4 12-11 12M14 9l-5 5" />,
  podium: <path d="M4 20v-6h5v6M9 20V9h6v11M15 20v-8h5v8M3 20h18M12 4l1 2h-2z" />,
  couronne: <path d="M4 17l-1-10 5 4 4-6 4 6 5-4-1 10zM4 20h16" />,
  bouclier: <path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6zM9 12l2 2 4-4" />,
  mains: <path d="M8 12l3-3 2 2 3-3 3 3-6 6-2-2-2 2-4-4 3-3M3 12l3-3" />,
  bulle: <path d="M20 12a7.5 7.5 0 0 1-11 6.6L4 20l1.4-4.6A7.5 7.5 0 1 1 20 12zM8.5 12h.01M12 12h.01M15.5 12h.01" />,
  coeur: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
};

export function BadgeIcone({ glyphe, niveau, taille = 48, gris = false }: { glyphe: string; niveau: Niveau; taille?: number; gris?: boolean }) {
  const c = COULEURS_NIVEAU[niveau] ?? COULEURS_NIVEAU.bronze;
  return (
    <svg width={taille} height={taille} viewBox="0 0 48 48" aria-hidden="true" className={gris ? "opacity-40 grayscale" : ""}>
      <circle cx="24" cy="24" r="22" fill={c.fond} stroke={c.bord} strokeWidth="3" />
      <circle cx="24" cy="24" r="16" fill="#FFFFFF" fillOpacity="0.35" />
      <g transform="translate(12 12)" fill="none" stroke="#1F3A26" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {GLYPHES[glyphe] ?? GLYPHES.etoile}
      </g>
    </svg>
  );
}
