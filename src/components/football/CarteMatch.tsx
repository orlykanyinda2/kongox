import Link from "next/link";
import type { MatchAffiche } from "@/lib/football/donnees";

const heure = new Intl.DateTimeFormat("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kinshasa" });

function quand(m: MatchAffiche) {
  if (m.statut === "en_cours") return "En cours";
  if (m.statut === "termine") return "Terminé";
  if (m.statut === "annule") return "Annulé";
  if (m.statut === "reporte") return "Reporté";
  const t = heure.format(new Date(m.date_match)).replace(/\.$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Carte d'un match (maquette Main, « Matchs à venir ») : championnat, heure de Kinshasa, équipes, 1 · N · 2.
export function CarteMatch({ m }: { m: MatchAffiche }) {
  const lien = m.marche_id ? `/marches/${m.marche_id}` : null;
  const fini = m.statut === "termine";
  const choix = [
    { cle: "1", libelle: `1 · ${m.pourcentages[0]} %` },
    { cle: "N", libelle: `N · ${m.pourcentages[1]} %` },
    { cle: "2", libelle: `2 · ${m.pourcentages[2]} %` },
  ];

  return (
    <article className="flex flex-col gap-3.5 rounded-carte border-2 border-contour bg-surface p-4 shadow-decale md:p-5 md:shadow-decale-md">
      <div className="flex justify-between gap-2 text-[13px] font-semibold text-texte-secondaire">
        <span>{m.ligue.nom}</span>
        <span className={m.statut === "en_cours" ? "flex items-center gap-1.5 text-brique" : ""}>
          {m.statut === "en_cours" && <span className="size-2 animate-pulse-direct rounded-full bg-brique" aria-hidden="true" />}
          {quand(m)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 font-titre text-[17px] font-bold md:text-[19px]">
        <span className="min-w-0 flex-1">{m.dom}</span>
        {fini ? (
          <span className="rounded-bouton bg-doux px-2.5 py-1 tabular-nums">
            {m.buts_dom} – {m.buts_ext}
          </span>
        ) : (
          <span className="text-sm text-texte-secondaire">vs</span>
        )}
        <span className="min-w-0 flex-1 text-right">{m.ext}</span>
      </div>
      {m.statut === "a_venir" && lien && m.ouvert ? (
        <div className="grid grid-cols-3 gap-2">
          {choix.map((c) => (
            <Link
              key={c.cle}
              href={`${lien}?choix=${c.cle}`}
              className="flex h-12 items-center justify-center rounded-bouton border border-separateur bg-doux text-sm font-bold text-texte hover:border-contour"
            >
              {c.libelle}
            </Link>
          ))}
        </div>
      ) : lien ? (
        <Link href={lien} className="text-center text-sm font-bold text-hunter underline dark:text-vert-jaune">
          {fini ? "Voir le résultat et les gains" : "Voir le marché"}
        </Link>
      ) : null}
    </article>
  );
}
