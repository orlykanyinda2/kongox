"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { proposer, type EtatProposition } from "@/app/actions/marches";
import { CATEGORIES, LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";
import { EtiquetteCategorie } from "./EtiquetteCategorie";
import { IconePiece } from "@/components/IconePiece";

const champ =
  "h-12 w-full rounded-bouton border-2 border-contour bg-surface px-3.5 text-[15px] text-texte outline-none focus-visible:ring-4 focus-visible:ring-vert-jaune/60";

const aperçuDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

// Formulaire « Proposer une question » (maquettes/Proposer.dc.html) avec aperçu en direct.
export function FormulaireProposition({ dateMin, dateMax }: { dateMin: string; dateMax: string }) {
  const t = useTranslations("proposer");
  const [categorie, setCategorie] = useState<Categorie>("football");
  const [question, setQuestion] = useState("");
  const [date, setDate] = useState("");
  const [etat, action, enCours] = useActionState<EtatProposition, FormData>(proposer, {});

  if (etat.marcheId) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 rounded-carte border-2 border-foret bg-vert-jaune p-6 text-center text-foret shadow-foret">
        <h2 className="text-2xl">{t("envoyeeTitre")}</h2>
        <p className="text-[15px] leading-normal">{t("envoyeeTexte")}</p>
        <Link href="/" className="flex h-12 items-center rounded-bouton bg-foret px-5 font-bold text-white">
          {t("retourAccueil")}
        </Link>
        <Link href="/profil" className="text-sm font-bold underline">
          {t("voirMesQuestions")}
        </Link>
      </div>
    );
  }

  const finAffichee = date ? t("fermeLe", { date: aperçuDate.format(new Date(`${date}T12:00:00`)) }) : t("fermeLeVide");

  return (
    <form action={action} className="flex flex-col gap-[18px]">
      <div className="flex animate-monte items-center gap-2.5 rounded-champ border-2 border-foret bg-vert-jaune px-3.5 py-3 text-foret shadow-foret">
        <IconePiece taille={20} />
        <span className="text-sm font-bold">{t("recompense")}</span>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-bold">{t("categorie")}</legend>
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
        <label htmlFor="question" className="mb-1.5 block text-sm font-bold">
          {t("question")}
        </label>
        <textarea
          id="question"
          name="question"
          rows={3}
          required
          minLength={15}
          maxLength={200}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("questionExemple")}
          aria-describedby="question-aide"
          className="w-full resize-none rounded-bouton border-2 border-contour bg-surface px-3.5 py-3 text-[15px] text-texte outline-none focus-visible:ring-4 focus-visible:ring-vert-jaune/60"
        />
        <p id="question-aide" className="mt-1.5 flex justify-between gap-3 text-xs text-texte-secondaire">
          <span>{t("questionAide")}</span>
          <span>{question.length}/200</span>
        </p>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-bold">{t("typeReponse")}</legend>
        <div className="grid grid-cols-2 gap-2">
          <span aria-current="true" className="flex h-[46px] items-center justify-center rounded-bouton border-2 border-foret bg-foret text-sm font-bold text-white dark:border-vert-jaune">
            OUI / NON
          </span>
          <span aria-disabled="true" className="flex h-[46px] items-center justify-center gap-1.5 rounded-bouton border-2 border-contour bg-surface text-sm font-bold text-texte opacity-60">
            {t("choixMultiples")} <small className="font-semibold">({t("bientot")})</small>
          </span>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label htmlFor="date_fin" className="mb-1.5 block text-sm font-bold">
            {t("dateFin")}
          </label>
          <input id="date_fin" name="date_fin" type="date" required min={dateMin} max={dateMax} value={date} onChange={(e) => setDate(e.target.value)} className={champ} />
        </div>
        <div>
          <label htmlFor="heure_fin" className="mb-1.5 block text-sm font-bold">
            {t("heure")}
          </label>
          <input id="heure_fin" name="heure_fin" type="time" required defaultValue="20:00" className={champ} />
        </div>
      </div>
      <p className="-mt-3 text-xs text-texte-secondaire">{t("heureKinshasa")}</p>

      <div>
        <label htmlFor="source" className="mb-1.5 block text-sm font-bold">
          {t("source")}
        </label>
        <input id="source" name="source" type="text" required minLength={3} maxLength={200} placeholder={t("sourceExemple")} className={champ} />
      </div>

      <section aria-label={t("apercu")} className="flex flex-col gap-2">
        <span className="text-sm font-bold">{t("apercu")}</span>
        <article className="flex flex-col gap-3 rounded-carte border-2 border-contour bg-surface p-4 shadow-decale">
          <div className="flex items-center justify-between">
            <EtiquetteCategorie categorie={categorie} petite />
            <span className="text-xs font-semibold text-texte-secondaire">{finAffichee}</span>
          </div>
          <span className="font-titre text-[17px] font-bold leading-[1.25]">{question || t("questionVide")}</span>
          <div className="h-2.5 overflow-hidden rounded-full border-2 border-foret bg-brique" aria-hidden="true">
            <div className="h-full w-1/2 bg-vert-jaune" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="flex h-[42px] items-center justify-center rounded-bouton border-2 border-foret bg-vert-jaune text-sm font-bold text-foret">OUI · 50 %</span>
            <span className="flex h-[42px] items-center justify-center rounded-bouton border-2 border-foret bg-brique text-sm font-bold text-white">NON · 50 %</span>
          </div>
        </article>
      </section>

      <section aria-label={t("regles")} className="rounded-champ border-2 border-contour bg-doux p-3.5">
        <h2 className="text-base">{t("regles")}</h2>
        <ul className="mt-2 list-disc pl-[18px] text-[13px] leading-[1.6]">
          <li>{t("regle1")}</li>
          <li>{t("regle2")}</li>
          <li className="font-semibold text-cat-musique-texte dark:text-[#F6D9D5]">{t("regle3")}</li>
        </ul>
      </section>

      {etat.erreur && (
        <p role="alert" className="rounded-bouton border-2 border-brique bg-brique/10 px-3 py-2.5 text-sm font-semibold">
          {etat.erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="h-14 rounded-champ border-2 border-foret bg-foret text-base font-bold text-white shadow-[4px_4px_0_#A7C957] disabled:opacity-70 dark:border-vert-jaune"
      >
        {enCours ? t("envoi") : t("envoyer")}
      </button>
      <p className="text-center text-[13px] text-texte-secondaire">{t("delai")}</p>
    </form>
  );
}
