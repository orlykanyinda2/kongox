// Icônes SVG fines (style Lucide), jamais d'emoji (DESIGN.md).
type P = { taille?: number; className?: string };

const base = (taille: number) => ({
  width: taille,
  height: taille,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function IconePartage({ taille = 16, className }: P) {
  return (
    <svg {...base(taille)} strokeWidth="2" className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

export function IconeWhatsApp({ taille = 18, className }: P) {
  return (
    <svg {...base(taille)} strokeWidth="2" className={className}>
      <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z" />
    </svg>
  );
}

export function IconePlus({ taille = 18, className, epaisseur = 2.5 }: P & { epaisseur?: number }) {
  return (
    <svg {...base(taille)} strokeWidth={epaisseur} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconeRetour({ taille = 20, className }: P) {
  return (
    <svg {...base(taille)} strokeWidth="2.5" className={className}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function IconeLecture({ taille = 18, className }: P) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M7 4l13 8-13 8z" />
    </svg>
  );
}

export function IconeMaison({ taille = 22, className }: P) {
  return (
    <svg {...base(taille)} strokeWidth="2" className={className}>
      <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function IconeBallon({ taille = 22, className }: P) {
  return (
    <svg {...base(taille)} strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3l2.5 5.5L12 12 9.5 8.5zM12 12l5 3M12 12l-5 3" />
    </svg>
  );
}

export function IconeTrophee({ taille = 22, className }: P) {
  return (
    <svg {...base(taille)} strokeWidth="2" className={className}>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}

export function IconeBulle({ taille = 22, className }: P) {
  return (
    <svg {...base(taille)} strokeWidth="2" className={className}>
      <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z" />
    </svg>
  );
}

export function IconeEtoile({ taille = 20, className }: P) {
  return (
    <svg {...base(taille)} strokeWidth="2.5" className={className}>
      <path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z" />
    </svg>
  );
}

export function IconeEtincelle({ taille = 40, className }: P) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" fill="#A7C957" />
    </svg>
  );
}
