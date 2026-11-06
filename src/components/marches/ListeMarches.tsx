"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Marche } from "@/lib/marches/donnees";
import { CATEGORIES, LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";
import { CarteMarche } from "./CarteMarche";

// Enlève les accents pour que « leopards » trouve « Léopards »
function simplifier(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Puces de catégories + liste des marchés, filtrées dans le navigateur (aucun aller-retour réseau).
export function ListeMarches({ marches }: { marches: Marche[] }) {
  const t = useTranslations("accueil");
  const recherche = useSearchParams().get("q")?.trim() ?? "";
  const [categorie, setCategorie] = useState<Categorie | "tous">("tous");

  const visibles = useMemo(() => {
    const q = simplifier(recherche);
    return marches.filter((m) => (categorie === "tous" || m.categorie === categorie) && (!q || simplifier(m.question).includes(q)));
  }, [marches, categorie, recherche]);

  const puce = (id: Categorie | "tous", libelle: string) => {
    const actif = categorie === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={actif}
        onClick={() => setCategorie(id)}
        className={`h-11 flex-none rounded-full border px-[18px] text-[15px] font-bold ${
          actif ? "border-foret bg-foret text-white dark:border-vert-jaune dark:bg-vert-jaune dark:text-foret" : "border-separateur bg-surface text-texte"
        }`}
      >
        {libelle}
      </button>
    );
  };

  return (
    <>
      <div role="group" aria-label={t("filtrer")} className="-mx-[18px] mt-0 flex gap-2 overflow-x-auto px-[18px] pb-0.5 md:mx-0 md:mt-6 md:flex-wrap md:px-0">
        {puce("tous", t("tous"))}
        {CATEGORIES.map((c) => puce(c, LIBELLES_CATEGORIES[c]))}
      </div>

      {recherche && (
        <p className="mt-4 text-sm text-texte-secondaire" role="status">
          {t("resultats", { nombre: visibles.length, recherche })}
        </p>
      )}

      {visibles.length > 0 ? (
        <div className="mt-[18px] grid gap-[18px] md:mt-6 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:gap-4">
          {visibles.map((m) => (
            <CarteMarche key={m.id} marche={m} libelles={{ pieces: t("piecesMisees"), partager: t("partagerWhatsApp") }} />
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-carte border-2 border-dashed border-sauge bg-doux p-6 text-center text-[15px]">{t("aucunMarche")}</p>
      )}
    </>
  );
}
