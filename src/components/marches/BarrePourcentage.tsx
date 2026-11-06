// Barre OUI (vert) sur fond NON (rouge brique). Toujours accompagnée du mot écrit à côté.
type Props = {
  pourcentage: number;
  variante?: "fine" | "epaisse"; // fine : cartes ; épaisse avec contour : Soki du jour, aperçu
  animee?: boolean;
  couleurOui?: "vert-jaune" | "sauge";
};

export function BarrePourcentage({ pourcentage, variante = "fine", animee = false, couleurOui = "sauge" }: Props) {
  const conteneur =
    variante === "epaisse" ? "h-3.5 rounded-full border-2 border-foret bg-brique overflow-hidden" : "h-2 rounded-full bg-brique overflow-hidden";
  return (
    <div className={`flex-1 ${conteneur}`} aria-hidden="true">
      <div
        className={`h-full ${couleurOui === "sauge" ? "bg-sauge dark:bg-vert-jaune" : "bg-vert-jaune"} ${animee ? "animate-remplit" : ""}`}
        style={{ width: `${pourcentage}%` }}
      />
    </div>
  );
}
