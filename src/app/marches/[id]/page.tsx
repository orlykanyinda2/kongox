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
import { IconeRetour, IconeWhatsApp } from "@/components/icones";
import { historiqueMarche, obtenirMarche, type Marche } from "@/lib/marches/donnees";
import { utilisateurConnecte } from "@/lib/compte/session";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterNombre, formaterPieces } from "@/lib/format";
import { lienWhatsApp, texteMarche } from "@/lib/partage";

// Page d'un marché (maquettes/Marche.dc.html).
// L'assistant IA et les commentaires arrivent à l'étape 5.
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

  const [marche, historique] = await Promise.all([obtenirMarche(numero), historiqueMarche(numero)]);
  if (!marche) notFound();
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
          <h1 className="text-[26px] leading-[1.15] md:text-[40px] md:tracking-[-1px]">{marche.question}</h1>
          <p className="text-[13px] text-texte-secondaire">
            {t("volume", { pieces: formaterNombre(marche.volume) })}
            {marche.auteur && <> · {t("proposePar", { nom: marche.auteur })}</>}
          </p>
          <GraphiqueMarche historique={historique} pourcentage={marche.pourcentageOui} />
        </div>

        <aside className="md:col-start-2 md:row-span-2 md:row-start-1">
          <div className="md:sticky md:top-24">
            <Suspense fallback={<div className="h-[460px] animate-pulse rounded-carte bg-hunter" />}>
              <PanneauPrediction marche={marche} />
            </Suspense>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4 md:col-start-1 md:row-start-2">
          <a
            href={lienWhatsApp(texteMarche(marche.question, marche.pourcentageOui, marche.id))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[52px] items-center justify-center gap-2 rounded-champ bg-cat-vie-fond text-[15px] font-bold text-hunter"
          >
            <IconeWhatsApp />
            {t("partagerWhatsApp")}
          </a>

          <Suspense fallback={null}>
            <MesPredictions marche={marche} />
          </Suspense>

          <section className="rounded-[18px] border-2 border-dashed border-sauge bg-doux p-4 text-sm leading-normal">
            <strong>{t("bientotTitre")}</strong> {t("bientotTexte")}
          </section>
        </div>
      </div>
    </main>
  );
}

// Panneau de prédiction : formulaire si connecté et marché ouvert, sinon message adapté
async function PanneauPrediction({ marche }: { marche: Marche }) {
  const t = await getTranslations("marche");

  if (!marche.ouvert) {
    const gagnante = marche.options.find((o) => o.id === marche.option_gagnante_id);
    return (
      <section className="flex flex-col gap-3 rounded-carte border-2 border-foret bg-hunter p-5 text-white shadow-brique-md">
        <h2 className="text-xl">{marche.statut === "regle" ? t("regleTitre") : t("fermeTitre")}</h2>
        {marche.statut === "regle" ? (
          gagnante ? (
            <p className="text-[15px]">
              {t("resultat")} <strong className="text-vert-jaune">{gagnante.libelle}</strong>
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
        pourcentageOui={marche.pourcentageOui}
        solde={u.solde_pieces}
        restant={Number(restant ?? 0)}
      />
    </div>
  );
}

// Mes mises sur ce marché
async function MesPredictions({ marche }: { marche: Marche }) {
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
          const libelle = marche.options.find((o) => o.id === p.option_id)?.libelle ?? "";
          return (
            <li key={p.id} className="flex items-center justify-between gap-3 border-b border-separateur py-2.5 text-[15px] last:border-b-0">
              <span>
                <strong className={libelle === "OUI" ? "text-hunter dark:text-vert-jaune" : "text-brique"}>{libelle}</strong> · {formaterPieces(p.montant)}
              </span>
              <span className="text-sm text-texte-secondaire">{t(`statut.${p.statut}`, { gain: formaterNombre(p.gain) })}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
