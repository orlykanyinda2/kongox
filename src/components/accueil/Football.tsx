import Link from "next/link";
import { CarteMatch } from "@/components/football/CarteMatch";
import { matchsAVenir } from "@/lib/football/donnees";
import { classementPublic } from "@/lib/classement/donnees";
import { formaterNombre } from "@/lib/format";

// « Matchs à venir » (maquette Main) : les 4 prochains matchs ouverts aux prédictions
export async function MatchsAVenirAccueil() {
  const matchs = (await matchsAVenir(12)).filter((m) => m.statut === "a_venir" && m.ouvert).slice(0, 4);
  if (matchs.length === 0) return null;
  return (
    <section id="football" className="mx-auto max-w-contenu scroll-mt-20 px-[18px] pb-6 pt-10 md:px-6 md:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] md:text-[40px] md:tracking-[-1px]">Matchs à venir</h2>
          <p className="mt-1 text-[15px] text-texte-secondaire md:mt-2 md:text-base">Choisis 1, N ou 2. Heures de Kinshasa.</p>
        </div>
        <Link href="/football" className="text-[15px] font-bold text-hunter underline dark:text-vert-jaune">
          Tous les matchs
        </Link>
      </div>
      <div className="mt-[18px] grid gap-4 md:mt-6 md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))]">
        {matchs.map((m) => (
          <CarteMatch key={m.id} m={m} />
        ))}
      </div>
    </section>
  );
}

const MEDAILLES = ["bg-vert-jaune", "bg-[#E4EAD3]", "bg-[#E8A66B]"];

// « Classement de la semaine » (maquette Main) : les 5 meilleurs scores Mayele
export async function ClassementSemaine() {
  const lignes = (await classementPublic("semaine", 5)).slice(0, 5);
  return (
    <div className="min-w-0 flex-[1_1_420px] rounded-[24px] border-2 border-contour bg-surface p-5 shadow-[8px_8px_0_var(--ombre)] md:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl md:text-[28px]">Classement de la semaine</h2>
        <span className="rounded-full bg-doux px-3 py-1.5 text-[13px] font-semibold">Score Mayele</span>
      </div>
      {lignes.length === 0 ? (
        <p className="mt-5 text-[15px] text-texte-secondaire">Le classement s&apos;affiche dès que des prédictions sont réglées cette semaine.</p>
      ) : (
        <ol className="mt-5 flex flex-col gap-2">
          {lignes.map((r, i) => (
            <li key={r.utilisateur_id} className="flex items-center gap-3.5 rounded-champ bg-doux px-3.5 py-3">
              <span className={`flex size-8 flex-none items-center justify-center rounded-[10px] text-sm font-bold text-foret ${MEDAILLES[i] ?? "bg-surface"}`}>{r.rang}</span>
              <Link href={`/u/${r.nom_utilisateur}`} className="min-w-0 flex-1 truncate text-[15px] font-bold hover:underline">
                @{r.nom_utilisateur}
              </Link>
              <span className="hidden text-sm text-texte-secondaire sm:inline">{Math.round(r.score_mayele)} % de réussite</span>
              <span className="min-w-[96px] text-right text-[15px] font-bold tabular-nums">{formaterNombre(r.solde_pieces)} pièces</span>
            </li>
          ))}
        </ol>
      )}
      <Link href="/classement" className="mt-4 inline-block text-sm font-bold text-hunter underline dark:text-vert-jaune">
        Classement complet
      </Link>
    </div>
  );
}
