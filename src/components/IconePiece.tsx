// Icône d'une pièce : cercle vert-jaune avec un anneau intérieur vert forêt (DESIGN.md).
export function IconePiece({ taille = 18 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" className="flex-none">
      <circle cx="12" cy="12" r="11" fill="#A7C957" stroke="#1F3A26" strokeWidth="2" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#1F3A26" strokeWidth="2" />
    </svg>
  );
}
