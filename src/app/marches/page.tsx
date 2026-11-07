import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { CarteMarche } from "@/components/marches/CarteMarche";
import { FiltresMarches } from "@/components/marches/FiltresMarches";
import { ChargementProgressif } from "@/components/marches/ChargementProgressif";
import { CATEGORIES, LIBELLES_CATEGORIES } from "@/lib/marches/categories";
import { communautesActives, lireFiltres, rechercherMarches, STATUTS, TRIS } from "@/lib/marches/fil";

export const metadata = { title: "Tous les marchés — KongoX" };

// Tous les marchés : recherche, filtres (catégorie, statut, communauté), tri, chargement progressif.
export default function PageMarches({ searchParams }: PageProps<"/marches">) {
  const t = useTranslations("fil");
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <main className="mx-auto w-full max-w-contenu flex-1 px-[18px] pb-10 pt-6 md:px-6">
        <h1 className="text-[32px] tracking-[-1px] md:text-[40px]">{t("titrePage")}</h1>
        <p className="mt-1.5 text-[15px] text-texte-secondaire">{t("textePage")}</p>
        <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-carte bg-doux" aria-busy="true" />}>
          <Contenu searchParams={searchParams} />
        </Suspense>
      </main>
      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}

async function Contenu({ searchParams }: { searchParams: PageProps<"/marches">["searchParams"] }) {
  const brut = await searchParams;
  const f = lireFiltres(brut);
  const [t, ta, { marches, total }, communautes] = await Promise.all([
    getTranslations("fil"),
    getTranslations("accueil"),
    rechercherMarches(f, 0),
    communautesActives(),
  ]);

  // Paramètres propres (seulement ceux qui ont une valeur), pour le chargement des pages suivantes
  const parametres: Record<string, string> = {};
  if (f.q) parametres.q = f.q;
  if (f.categorie) parametres.categorie = f.categorie;
  if (f.statut !== "en_ligne") parametres.statut = f.statut;
  if (f.communaute) parametres.communaute = String(f.communaute);
  if (f.tri !== "tendance") parametres.tri = f.tri;
  const cle = new URLSearchParams(parametres).toString();

  const libelles = { pieces: ta("piecesMisees"), partager: ta("partagerWhatsApp"), sponsorise: t("sponsorise") };

  return (
    <>
      <FiltresMarches
        key={cle}
        valeurs={{ q: f.q, categorie: f.categorie, statut: f.statut, communaute: f.communaute ? String(f.communaute) : "", tri: f.tri }}
        categories={CATEGORIES.map((c) => ({ valeur: c, libelle: LIBELLES_CATEGORIES[c] }))}
        statuts={STATUTS.map((s) => ({ valeur: s, libelle: t(`statut_${s}`) }))}
        tris={TRIS.map((s) => ({ valeur: s, libelle: t(`tri_${s}`) }))}
        communautes={communautes.map((c) => ({ valeur: String(c.id), libelle: c.nom }))}
        libelles={{
          rechercher: t("rechercher"),
          exemple: t("rechercherExemple"),
          categorie: t("categorie"),
          toutes: t("toutes"),
          statut: t("statut"),
          communaute: t("communaute"),
          tri: t("tri"),
          appliquer: t("appliquer"),
          effacer: t("effacer"),
        }}
      />

      <p className="mt-5 text-sm text-texte-secondaire" role="status">
        {f.q ? t("totalRecherche", { nombre: total, recherche: f.q }) : t("total", { nombre: total })}
      </p>

      {marches.length === 0 ? (
        <p className="mt-4 rounded-carte border-2 border-dashed border-sauge bg-doux p-6 text-center text-[15px]">{t("aucunResultat")}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-[18px] md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:gap-4">
            {marches.map((m, i) => (
              <CarteMarche key={m.id} marche={m} libelles={libelles} suivi={{ section: "marches", position: i + 1 }} />
            ))}
          </div>
          <ChargementProgressif
            key={cle}
            parametres={parametres}
            dejaAffiches={marches.length}
            total={total}
            libelles={{
              ...libelles,
              chargerPlus: t("chargerPlus"),
              chargement: t("chargement"),
              fin: t("fin"),
              erreur: t("erreurChargement"),
            }}
          />
        </>
      )}
    </>
  );
}
