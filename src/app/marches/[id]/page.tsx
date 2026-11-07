import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { EtiquetteCategorie } from "@/components/marches/EtiquetteCategorie";
import { GraphiqueMarche } from "@/components/marches/GraphiqueMarche";
import { FormulairePrediction } from "@/components/marches/FormulairePrediction";
import { IconeRetour } from "@/components/icones";
import { historiqueMarche, obtenirMarche, type Marche } from "@/lib/marches/donnees";
import { matchDuMarche } from "@/lib/football/donnees";
import { RepartitionMatch } from "@/components/football/RepartitionMatch";
import { AssistantServeur } from "@/components/ia/AssistantServeur";
import { SalonServeur } from "@/components/chat/SalonServeur";
import { SignalerMarche } from "@/components/chat/SignalerMarche";
import { utilisateurConnecte } from "@/lib/compte/session";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterNombre, formaterPieces } from "@/lib/format";
import { OPEN_GRAPH, urlSite } from "@/lib/partage";
import type { Metadata } from "next";
import { BoutonsPartage } from "@/components/social/BoutonsPartage";
import { lireReglages } from "@/lib/reglages";

// Page d'un marché (maquettes/Marche.dc.html).
// L'assistant IA et le salon du marché (commentaires en direct) sont sous le graphique.
export async function generateMetadata({ params }: PageProps<"/marches/[id]">): Promise<Metadata> {
  const numero = Number((await params).id);
  if (!Number.isInteger(numero) || numero <= 0) return {};
  const [marche, match] = await Promise.all([obtenirMarche(numero), matchDuMarche(numero)]);
  if (!marche || !["approuve", "ferme", "regle"].includes(marche.statut)) return { robots: { index: false } };
  const titre = match ? `${match.dom} – ${match.ext} : 1, N ou 2 ?` : marche.question;
  const description = match
    ? `${match.ligue.nom} · 1 ${match.pourcentages[0]} %, N ${match.pourcentages[1]} %, 2 ${match.pourcentages[2]} %. Donne ton avis avec tes pièces gratuites sur KongoX.`
    : `${marche.pourcentageOui} % pensent OUI, ${100 - marche.pourcentageOui} % NON. Donne ton avis avec tes pièces gratuites sur KongoX.`;
  return {
    title: `${titre} — KongoX`,
    description,
    alternates: { canonical: `/marches/${numero}` },
    openGraph: { ...OPEN_GRAPH, title: titre, description, url: `/marches/${numero}` },
  };
}

export default function PageMarche({ params }: PageProps<"/marches/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <Suspense fallback={<Chargement />}>
        <ContenuMarche params={params} />
      </Suspense>
      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}

function Chargement() {
  return (
    <main className="mx-auto w-full max-w-contenu flex-1 px-[18px] py-6 md:px-6" aria-busy="true">
      <div className="h-24 animate-pulse rounded-carte bg-doux" />
      <div className="mt-4 h-64 animate-pulse rounded-carte bg-doux" />
    </main>
  );
}

const dateFin = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kinshasa" });

async function ContenuMarche({ params }: { params: PageProps<"/marches/[id]">["params"] }) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  const [marche, historique, match] = await Promise.all([obtenirMarche(numero), historiqueMarche(numero), matchDuMarche(numero)]);
  if (!marche) notFound();
  // Marché d'un match (1 N 2) : boutons « 1 · Équipe », « N · Nul », « 2 · Équipe »
  const libelles = match ? [`1 · ${match.dom}`, "N · Nul", `2 · ${match.ext}`] : marche.options.map((o) => o.libelle);
  const pourcentages = match ? match.pourcentages : [marche.pourcentageOui, 100 - marche.pourcentageOui];
  const t = await getTranslations("marche");

  return (
    <main className="mx-auto w-full max-w-contenu flex-1 px-[18px] py-5 md:px-6 md:py-8">
      <Link href="/#marches" className="inline-flex h-11 items-center gap-1 rounded-bouton pr-3 text-sm font-semibold text-texte-secondaire">
        <IconeRetour taille={18} />
        {t("retour")}
      </Link>

      {/* Une seule grille : sur mobile tout s'empile (le panneau vient après le graphique),
          sur ordinateur le panneau passe dans la colonne de droite et reste visible */}
      <div className="mt-2 grid gap-4 md:grid-cols-[minmax(0,1fr)_400px] md:grid-rows-[auto_1fr] md:gap-x-8">
        <div className="flex min-w-0 flex-col gap-4 md:col-start-1 md:row-start-1">
          <div className="flex flex-wrap items-center gap-2">
            <EtiquetteCategorie categorie={marche.categorie} petite />
            <span className="text-xs font-semibold text-texte-secondaire md:text-[13px]">
              {t("fermeLe", { date: dateFin.format(new Date(marche.date_fin)), source: marche.source })}
            </span>
          </div>
          <h1 className="text-[26px] leading-[1.15] md:text-[40px] md:tracking-[-1px]">{match ? `${match.dom} – ${match.ext}` : marche.question}</h1>
          <p className="text-[13px] text-texte-secondaire">
            {t("volume", { pieces: formaterNombre(marche.volume) })}
            {marche.auteur && <> · {t("proposePar", { nom: marche.auteur })}</>}
          </p>
          {marche.sponsor && (
            <p className="self-start rounded-full border border-separateur px-3 py-1 text-xs font-bold text-texte-secondaire">{t("offertePar", { sponsor: marche.sponsor })}</p>
          )}
          {match ? <RepartitionMatch m={match} libelles={libelles} /> : <GraphiqueMarche historique={historique} pourcentage={marche.pourcentageOui} />}
        </div>

        <aside className="md:col-start-2 md:row-span-2 md:row-start-1">
          <div className="md:sticky md:top-24">
            <Suspense fallback={<div className="h-[460px] animate-pulse rounded-carte bg-hunter" />}>
              <PanneauPrediction marche={marche} libelles={libelles} pourcentages={pourcentages} />
            </Suspense>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4 md:col-start-1 md:row-start-2">
          <BoutonsPartage
            url={`${urlSite()}/marches/${marche.id}`}
            texte={
              match
                ? `${match.dom} – ${match.ext} : 1 ${match.pourcentages[0]} %, N ${match.pourcentages[1]} %, 2 ${match.pourcentages[2]} % sur KongoX. Et toi ?`
                : `${marche.question} — ${marche.pourcentageOui} % pensent OUI sur KongoX. Et toi ?`
            }
            carte={`/marches/${marche.id}/opengraph-image`}
          />

          <Suspense fallback={null}>
            <MesPredictions marche={marche} libelles={libelles} />
          </Suspense>

          <Suspense fallback={<div className="h-64 animate-pulse rounded-[18px] bg-doux" />}>
            <AssistantServeur marche={marche.id} />
          </Suspense>

          <Suspense fallback={<div className="h-48 animate-pulse rounded-[18px] bg-doux" />}>
            <SalonServeur cible={{ marche: marche.id }} type={match ? "match" : "marche"} />
          </Suspense>

          {!match && (
            <Suspense fallback={null}>
              <SignalerMarcheSiConnecte marche={marche.id} />
            </Suspense>
          )}
        </div>
      </div>
    </main>
  );
}

// Panneau de prédiction : formulaire si connecté et marché ouvert, sinon message adapté
async function PanneauPrediction({ marche, libelles, pourcentages }: { marche: Marche; libelles: string[]; pourcentages: number[] }) {
  const t = await getTranslations("marche");

  if (!marche.ouvert) {
    const gagnante = marche.options.find((o) => o.id === marche.option_gagnante_id);
    return (
      <section className="flex flex-col gap-3 rounded-carte border-2 border-foret bg-hunter p-5 text-white shadow-brique-md">
        <h2 className="text-xl">{marche.statut === "regle" ? t("regleTitre") : t("fermeTitre")}</h2>
        {marche.statut === "regle" ? (
          gagnante ? (
            <p className="text-[15px]">
              {t("resultat")} <strong className="text-vert-jaune">{libelles[marche.options.indexOf(gagnante)] ?? gagnante.libelle}</strong>
            </p>
          ) : (
            <p className="text-[15px]">{t("annule", { motif: marche.motif ?? "" })}</p>
          )
        ) : (
          <p className="text-[15px]">{t("fermeTexte")}</p>
        )}
        {marche.lien_resultat && (
          <a href={marche.lien_resultat} target="_blank" rel="noopener noreferrer" className="text-sm font-bold underline">
            {t("voirSource")}
          </a>
        )}
      </section>
    );
  }

  const u = await utilisateurConnecte();
  if (!u) {
    return (
      <section className="flex flex-col gap-3.5 rounded-carte border-2 border-foret bg-hunter p-5 text-white shadow-brique-md">
        <h2 className="text-xl">{t("connexionTitre")}</h2>
        <p className="text-[15px] text-[#E4EAD3]">{t("connexionTexte")}</p>
        <Link href="/inscription" className="flex h-14 items-center justify-center rounded-champ bg-vert-jaune text-[17px] font-bold text-foret">
          {t("creerCompte")}
        </Link>
        <Link href="/connexion" className="text-center text-sm font-bold underline">
          {t("dejaCompte")}
        </Link>
      </section>
    );
  }

  const supabase = await creerClientServeur();
  const reglages = await lireReglages();
  const [{ data: restant }, { data: dernieres }] = await Promise.all([
    supabase.rpc("mise_restante_aujourdhui"),
    supabase.from("predictions").select("statut").in("statut", ["gagnee", "perdue"]).order("cree_le", { ascending: false }).limit(3),
  ]);
  // Protection contre l'addiction : message bienveillant après 3 pertes de suite
  const seriePertes = (dernieres ?? []).length === 3 && (dernieres ?? []).every((p) => p.statut === "perdue");

  return (
    <div className="flex flex-col gap-3">
      {seriePertes && (
        <p role="status" className="rounded-champ border-2 border-foret bg-champagne p-3.5 text-[15px] font-semibold text-foret">
          {t("pause")}
        </p>
      )}
      <FormulairePrediction
        marcheId={marche.id}
        options={marche.options}
        pourcentages={pourcentages}
        libelles={libelles}
        solde={u.solde_pieces}
        restant={Number(restant ?? 0)}
        miseMinimum={Number(reglages.mise_minimum)}
      />
    </div>
  );
}

// Mes mises sur ce marché
async function MesPredictions({ marche, libelles }: { marche: Marche; libelles: string[] }) {
  const u = await utilisateurConnecte();
  if (!u) return null;
  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("predictions")
    .select("id, option_id, montant, statut, gain")
    .eq("marche_id", marche.id)
    .order("cree_le", { ascending: false })
    .returns<{ id: number; option_id: number; montant: number; statut: string; gain: number }[]>();
  if (!data || data.length === 0) return null;
  const t = await getTranslations("marche");

  return (
    <section className="rounded-[18px] border-2 border-contour bg-surface p-4 shadow-decale">
      <h2 className="text-lg">{t("mesMises")}</h2>
      <ul className="mt-2">
        {data.map((p) => {
          const i = marche.options.findIndex((o) => o.id === p.option_id);
          const libelle = libelles[i] ?? "";
          return (
            <li key={p.id} className="flex items-center justify-between gap-3 border-b border-separateur py-2.5 text-[15px] last:border-b-0">
              <span>
                <strong className={i === 0 ? "text-hunter dark:text-vert-jaune" : "text-brique"}>{libelle}</strong> · {formaterPieces(p.montant)}
              </span>
              <span className="text-sm text-texte-secondaire">{t(`statut.${p.statut}`, { gain: formaterNombre(p.gain) })}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// « Signaler ce marché » (question floue, ligne rouge…) : pour les personnes connectées
async function SignalerMarcheSiConnecte({ marche }: { marche: number }) {
  const u = await utilisateurConnecte();
  return u ? <SignalerMarche marche={marche} /> : null;
}
