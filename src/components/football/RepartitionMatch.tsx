import type { MatchAffiche } from "@/lib/football/donnees";
import { formaterNombre } from "@/lib/format";

const quand = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kinshasa" });

// Ce que pense la communauté pour un match : 1, N, 2 (le mot est toujours écrit à côté de la couleur)
export function RepartitionMatch({ m, libelles }: { m: MatchAffiche; libelles: string[] }) {
  const couleurs = ["bg-vert-jaune", "bg-champagne", "bg-brique"];
  return (
    <section aria-label="Répartition des prédictions" className="flex flex-col gap-3 rounded-[18px] border-2 border-contour bg-surface p-4 shadow-decale md:p-6 md:shadow-decale-md">
      <p className="text-sm text-texte-secondaire">
        {m.ligue.nom}
        {m.journee ? ` · ${m.journee}` : ""} · <span className="capitalize">{quand.format(new Date(m.date_match))}</span> (heure de Kinshasa)
      </p>
      {m.statut === "termine" && (
        <p className="font-titre text-3xl font-bold tabular-nums">
          {m.dom} {m.buts_dom} – {m.buts_ext} {m.ext}
        </p>
      )}
      <div className="flex h-4 overflow-hidden rounded-full border-2 border-foret" aria-hidden="true">
        {m.pourcentages.map((p, i) => (
          <div key={i} className={couleurs[i]} style={{ width: `${p}%` }} />
        ))}
      </div>
      <ul className="grid grid-cols-3 gap-2 text-sm">
        {libelles.map((l, i) => (
          <li key={l} className="rounded-bouton bg-doux px-2 py-2 text-center">
            <span className="block font-titre text-2xl font-bold">{m.pourcentages[i]} %</span>
            <span className="text-texte-secondaire">{l}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-texte-secondaire">{formaterNombre(m.volume)} pièces misées · gains versés automatiquement après le match.</p>
    </section>
  );
}
