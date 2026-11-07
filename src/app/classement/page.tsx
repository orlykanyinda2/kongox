import { Suspense } from "react";
import Link from "next/link";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { classementPublic, derniersGagnants, duelsPublics, estPeriode, PERIODES, type LigneClassement, type Periode } from "@/lib/classement/donnees";
import { utilisateurConnecte } from "@/lib/compte/session";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterNombre } from "@/lib/format";
import { urlSite } from "@/lib/partage";
import { BoutonsPartage } from "@/components/social/BoutonsPartage";

export const metadata = { title: "Classement — KongoX" };

// Classement (maquettes/Classement.dc.html) : podium, classement complet, ma place, communauté contre communauté.
export default function PageClassement({ searchParams }: PageProps<"/classement">) {
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <main className="relative mx-auto w-full max-w-contenu flex-1 px-[18px] pt-8 md:px-6 md:pt-12">
        <div className="text-center">
          <h1 className="animate-monte text-[clamp(40px,6vw,80px)] leading-[0.95] tracking-[-2px]">
            Qui a le plus
            <br />
            <span className="mt-3 inline-block animate-rebond rounded-[30px] border-4 border-foret bg-vert-jaune px-7 pb-2.5 pt-0.5 text-foret shadow-[8px_8px_0_#1F3A26]">
              de mayele ?
            </span>
          </h1>
          <p className="mx-auto mt-7 max-w-[560px] animate-monte text-[17px] leading-normal text-texte-secondaire delai-200">
            Le score Mayele, c&apos;est le pourcentage de prédictions justes. Les plus réguliers reçoivent des petits cadeaux.
          </p>
        </div>
        <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-carte bg-doux" />}>
          <Contenu searchParams={searchParams} />
        </Suspense>
      </main>
      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}

type Ma = { rang: number | null; score_mayele: number | null; reglees: number; minimum: number; solde: number; nom: string } | null;

const TYPES_CADEAU: Record<string, string> = { credit: "Crédit", forfait_internet: "Forfait internet", produit: "Produit" };

async function Contenu({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const periode: Periode = estPeriode(params.periode) ? params.periode : "semaine";
  const amis = params.vue === "amis";
  const [u, gagnants] = await Promise.all([utilisateurConnecte(), derniersGagnants(5)]);

  let lignes: LigneClassement[];
  let ma: Ma = null;
  if (u) {
    const supabase = await creerClientServeur();
    const [{ data: liste }, { data: moi }] = await Promise.all([
      amis ? supabase.rpc("classement", { p_periode: periode, p_limite: 50, p_amis: true }) : Promise.resolve({ data: null }),
      supabase.rpc("mon_classement", { p_periode: periode }),
    ]);
    lignes = amis ? ((liste ?? []) as LigneClassement[]).map((l) => ({ ...l, rang: Number(l.rang), score_mayele: Number(l.score_mayele), solde_pieces: Number(l.solde_pieces) })) : await classementPublic(periode, 50);
    ma = moi as Ma;
  } else {
    lignes = await classementPublic(periode, 50);
  }
  const duels = await duelsPublics(periode);

  const onglet = (p: Periode, libelle: string) => {
    const actif = p === periode;
    return (
      <Link
        key={p}
        href={`/classement?periode=${p}${amis ? "&vue=amis" : ""}`}
        role="tab"
        aria-selected={actif}
        className={`flex h-11 items-center rounded-bouton px-4 text-[15px] font-bold ${actif ? "bg-foret text-white dark:bg-vert-jaune dark:text-foret" : "text-texte"}`}
      >
        {libelle}
      </Link>
    );
  };

  const podium = [lignes[1], lignes[0], lignes[2]];
  const hauteurs = ["h-[260px]", "h-[300px]", "h-[240px]"];
  const medailles = ["bg-vert-clair", "bg-vert-jaune", "bg-cat-musique-fond"];
  const jeSuisDansLaListe = ma?.rang ? lignes.some((l) => l.nom_utilisateur === ma?.nom) : false;

  return (
    <>
      <div className="mt-6 flex flex-col items-center gap-3">
        <div role="tablist" aria-label="Période" className="inline-flex flex-wrap justify-center gap-1.5 rounded-champ border-2 border-contour bg-doux p-[5px]">
          {PERIODES.map((p) => onglet(p.cle, p.libelle))}
        </div>
        {u && (
          <div className="flex gap-3 text-sm font-bold">
            <Link href={`/classement?periode=${periode}`} aria-current={!amis ? "page" : undefined} className={!amis ? "underline" : "text-texte-secondaire"}>
              Tout le monde
            </Link>
            <Link href={`/classement?periode=${periode}&vue=amis`} aria-current={amis ? "page" : undefined} className={amis ? "underline" : "text-texte-secondaire"}>
              Entre amis (ceux que je suis)
            </Link>
          </div>
        )}
      </div>

      {lignes.length === 0 ? (
        <p className="mx-auto mt-10 max-w-lg rounded-carte border-2 border-dashed border-sauge bg-doux p-6 text-center text-[15px]">
          {amis
            ? "Personne ici pour l'instant : suis des pronostiqueurs depuis leur profil."
            : `Pas encore de classement pour cette période : il faut au moins ${ma?.minimum ?? 5} prédictions réglées pour y entrer.`}
        </p>
      ) : (
        <section aria-label="Podium" className="mt-10 hidden flex-wrap items-end justify-center gap-5 md:flex">
          {podium.map((r, i) =>
            r ? (
              <article
                key={r.utilisateur_id}
                className={`flex w-[220px] flex-col items-center justify-end gap-1 rounded-[24px] border-2 border-foret bg-white p-5 text-center text-foret ${hauteurs[i]} ${
                  i === 1 ? "shadow-[8px_8px_0_#BC4749]" : "shadow-[8px_8px_0_#6A994E]"
                }`}
              >
                <span className={`mb-auto flex size-14 items-center justify-center rounded-[18px] border-[3px] border-foret font-titre text-[26px] font-bold ${medailles[i]}`}>{r.rang}</span>
                <Link href={`/u/${r.nom_utilisateur}`} className="max-w-full truncate font-titre text-xl font-bold hover:underline">
                  @{r.nom_utilisateur}
                </Link>
                <span className="text-sm text-[#4B5A44]">{Math.round(r.score_mayele)} % de réussite</span>
                <span className="font-titre text-[26px] font-bold tabular-nums">{formaterNombre(r.solde_pieces)}</span>
                <span className="text-xs text-[#4B5A44]">pièces</span>
              </article>
            ) : null,
          )}
        </section>
      )}

      <div className="mt-10 flex flex-wrap items-start gap-6 pb-6 md:mt-12">
        <section aria-label="Classement complet" className="min-w-0 flex-[999_1_600px] rounded-carte border-2 border-contour bg-surface p-5 shadow-[8px_8px_0_var(--ombre)] md:p-6">
          <h2 className="text-[26px]">Classement complet</h2>
          <ol className="mt-4 flex flex-col gap-2">
            {lignes.map((r) => (
              <li
                key={r.utilisateur_id}
                // Sur ordinateur, les 3 premiers sont sur le podium
                className={`flex items-center gap-3.5 rounded-champ px-3.5 py-3 ${r.rang <= 3 && lignes.length > 3 ? "md:hidden" : ""} ${r.nom_utilisateur === ma?.nom ? "border-2 border-foret bg-vert-jaune text-foret" : "bg-doux"}`}
              >
                <span className="flex size-[34px] flex-none items-center justify-center rounded-[10px] border-2 border-foret bg-white text-sm font-bold text-foret">{r.rang}</span>
                <Link href={`/u/${r.nom_utilisateur}`} className="min-w-0 flex-1 truncate text-[15px] font-bold hover:underline">
                  {r.nom_utilisateur === ma?.nom ? "Toi · " : ""}@{r.nom_utilisateur}
                </Link>
                <span className="text-sm">{Math.round(r.score_mayele)} %</span>
                <span className="hidden text-xs text-texte-secondaire sm:inline">{r.predictions_gagnees}/{r.predictions_reglees}</span>
                <span className="min-w-[110px] text-right text-[15px] font-bold tabular-nums">{formaterNombre(r.solde_pieces)} pièces</span>
              </li>
            ))}
            {ma && !jeSuisDansLaListe && (
              <li className="flex items-center gap-3.5 rounded-champ border-2 border-foret bg-vert-jaune px-3.5 py-3 text-foret shadow-foret">
                <span className="flex size-[34px] flex-none items-center justify-center rounded-[10px] border-2 border-foret bg-white text-xs font-bold">{ma.rang ?? "—"}</span>
                <span className="min-w-0 flex-1 text-[15px] font-bold">Toi · @{ma.nom}</span>
                <span className="text-sm">
                  {ma.rang ? `${Math.round(Number(ma.score_mayele))} %` : `${ma.reglees}/${ma.minimum} prédictions réglées pour entrer`}
                </span>
                <span className="min-w-[110px] text-right text-[15px] font-bold tabular-nums">{formaterNombre(ma.solde)} pièces</span>
              </li>
            )}
          </ol>
        </section>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <section className="flex flex-col gap-[18px] rounded-carte border-2 border-foret bg-hunter p-[22px] text-white shadow-brique-md">
            <h2 className="text-[22px]">Communauté contre communauté</h2>
            {duels.length === 0 ? (
              <p className="text-sm text-[#E4EAD3]">Les duels entre villes, universités et fan-clubs arrivent bientôt. Rejoins ta communauté dans ton profil.</p>
            ) : (
              <div className="flex flex-col gap-4 rounded-champ bg-white p-4 text-foret">
                {duels.map((d) => (
                  <div key={d.id} className="flex flex-col gap-2">
                    <span className="text-[13px] font-bold uppercase text-[#4B5A44]">{d.titre} · score Mayele moyen</span>
                    <div className="flex justify-between gap-2 text-[15px] font-bold">
                      <span>
                        {d.nom_a} · {d.part_a} %
                      </span>
                      <span>
                        {100 - d.part_a} % · {d.nom_b}
                      </span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full border-2 border-foret bg-brique" aria-hidden="true">
                      <div className="h-full animate-remplit bg-vert-jaune" style={{ width: `${d.part_a}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <div className="rounded-carte border-2 border-contour bg-surface p-[22px] shadow-decale-md">
            <h2 className="mb-3 text-xl">{ma?.rang ? "Partage ta place" : "Partager le classement"}</h2>
            <BoutonsPartage
              url={ma?.nom ? `${urlSite()}/u/${encodeURIComponent(ma.nom)}` : `${urlSite()}/classement`}
              texte={
                ma?.rang
                  ? `Je suis n° ${ma.rang} du classement KongoX (${PERIODES.find((x) => x.cle === periode)?.libelle.toLowerCase()}), score Mayele ${ma.score_mayele} %. Tu fais mieux ?`
                  : "Qui a le plus de mayele ? Le classement des pronostiqueurs KongoX."
              }
              carte={ma?.nom ? `/u/${encodeURIComponent(ma.nom)}/opengraph-image` : undefined}
            />
          </div>
          <section className="rounded-carte border-2 border-contour bg-surface p-[22px] shadow-decale-md">
            <h2 className="text-xl">Cadeaux de la semaine</h2>
            <p className="mt-2 text-sm leading-normal text-texte-secondaire">
              L&apos;équipe choisit les plus réguliers et envoie du crédit ou un forfait internet. Ajoute ton numéro dans{" "}
              <Link href="/profil" className="font-bold underline">
                ton profil
              </Link>{" "}
              pour être éligible.
            </p>
            {gagnants.length > 0 && (
              <>
                <h3 className="mt-4 text-[15px]">Derniers gagnants</h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {gagnants.map((g, i) => (
                    <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-2 rounded-bouton bg-doux px-3 py-2 text-sm">
                      <Link href={`/u/${g.nom_utilisateur}`} className="font-bold">
                        @{g.nom_utilisateur}
                      </Link>
                      <span className="text-[13px] text-texte-secondaire">
                        {TYPES_CADEAU[g.type] ?? "Cadeau"}
                        {g.sponsor ? ` · offert par ${g.sponsor}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
