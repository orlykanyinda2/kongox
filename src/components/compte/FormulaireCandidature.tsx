"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { postulerCurateur, type EtatAction } from "@/app/actions/admin";
import { CATEGORIES, LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";

// Candidature pour devenir curateur d'un thème
export function FormulaireCandidature() {
  const t = useTranslations("curateur");
  const [categorie, setCategorie] = useState<Categorie>("football");
  const [texte, setTexte] = useState("");
  const [etat, action, enCours] = useActionState<EtatAction, FormData>(postulerCurateur, {});

  if (etat.succes) {
    return (
      <p role="status" className="rounded-carte border-2 border-foret bg-vert-jaune p-5 font-semibold text-foret shadow-foret">
        {etat.succes}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-carte border-2 border-contour bg-surface p-5 shadow-decale-md">
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold">{t("theme")}</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <label
              key={c}
              className={`flex h-11 cursor-pointer items-center rounded-full border-2 border-contour px-3.5 text-sm font-bold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-vert-jaune/60 ${
                c === categorie ? "bg-foret text-white dark:bg-vert-jaune dark:text-foret" : "bg-surface text-texte"
              }`}
            >
              <input type="radio" name="categorie" value={c} checked={c === categorie} onChange={() => setCategorie(c)} className="sr-only" />
              {LIBELLES_CATEGORIES[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="motivation" className="mb-1.5 block text-sm font-bold">
          {t("motivation")}
        </label>
        <textarea
          id="motivation"
          name="motivation"
          rows={4}
          required
          minLength={20}
          maxLength={1000}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={t("motivationExemple")}
          className="w-full resize-none rounded-bouton border-2 border-contour bg-surface px-3.5 py-3 text-[15px] text-texte"
        />
        <p className="mt-1 text-right text-xs text-texte-secondaire">{texte.length}/1000</p>
      </div>
      {etat.erreur && (
        <p role="alert" className="rounded-bouton bg-brique px-3 py-2 text-sm font-semibold text-white">
          {etat.erreur}
        </p>
      )}
      <button type="submit" disabled={enCours} className="h-14 rounded-champ border-2 border-foret bg-foret font-bold text-white shadow-[4px_4px_0_#A7C957] dark:border-vert-jaune">
        {enCours ? "…" : t("envoyer")}
      </button>
    </form>
  );
}
