"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { approuver, modifier, refuser, validerDecision, type EtatAction } from "@/app/actions/admin";
import { CATEGORIES, LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";
import { EtiquetteCategorie } from "@/components/marches/EtiquetteCategorie";
import { BoutonAction, MessageEtat } from "./BoutonAction";

export type QuestionEnAttente = {
  id: number;
  question: string;
  categorie: Categorie;
  source: string;
  date_fin: string;
  cree_le: string;
  auteur: string | null;
  ageHeures: number;
  finLibelle: string;
  dateFinJour: string; // AAAA-MM-JJ (Kinshasa) pour le formulaire
  dateFinHeure: string; // HH:MM
  decision: { id: number; decision: "approuve" | "refuse"; motif: string | null; curateur: string } | null;
};

const champ = "h-11 w-full rounded-bouton border-2 border-contour bg-surface px-3 text-[15px] text-texte";

// Une question de la file d'approbation (maquette Admin) : Approuver, Modifier le texte, Refuser.
export function CarteApprobation({ q, admin, essai }: { q: QuestionEnAttente; admin: boolean; essai: boolean }) {
  const t = useTranslations("admin");
  const [ouvert, setOuvert] = useState<"modifier" | "refuser" | null>(null);
  const [etatRefus, actionRefus, refusEnCours] = useActionState<EtatAction, FormData>(refuser.bind(null, q.id), {});
  const [etatModif, actionModif, modifEnCours] = useActionState<EtatAction, FormData>(modifier.bind(null, q.id), {});
  const enRetard = q.ageHeures >= 12;
  const decisionEnAttente = q.decision !== null;

  return (
    <article className="flex flex-col gap-3 rounded-carte border-2 border-contour bg-surface p-5 shadow-decale-md">
      <div className="flex flex-wrap items-center gap-2.5">
        <EtiquetteCategorie categorie={q.categorie} petite />
        {q.auteur && (
          <span className="text-[13px] text-texte-secondaire">
            {t("proposeePar")} <strong className="text-texte">@{q.auteur}</strong>
          </span>
        )}
        <span className="flex-1" />
        <span
          className={`rounded-full border-2 border-foret px-2.5 py-[5px] text-xs font-bold ${enRetard ? "bg-brique text-white" : "bg-vert-clair text-foret"}`}
        >
          {t("recueIlYa", { heures: q.ageHeures })}
        </span>
      </div>

      <h2 className="text-[21px] leading-[1.25]">{q.question}</h2>
      <div className="flex flex-wrap gap-x-[18px] gap-y-1 text-sm text-texte-secondaire">
        <span>
          {t("fin")} <strong className="text-texte">{q.finLibelle}</strong>
        </span>
        <span>
          {t("source")} <strong className="text-texte">{q.source}</strong>
        </span>
        <span>
          {t("type")} <strong className="text-texte">OUI / NON</strong>
        </span>
      </div>

      {q.decision && (
        <div className="flex flex-wrap items-center gap-3 rounded-bouton border-2 border-dashed border-sauge bg-doux p-3 text-sm">
          <span className="flex-1">
            {t(q.decision.decision === "approuve" ? "decisionApprouve" : "decisionRefuse", { nom: q.decision.curateur })}
            {q.decision.motif && <> — « {q.decision.motif} »</>}
          </span>
          {admin && (
            <>
              <BoutonAction action={() => validerDecision(q.decision!.id, true)} libelle={t("valider")} variante="oui" petit />
              <BoutonAction action={() => validerDecision(q.decision!.id, false)} libelle={t("rejeter")} variante="clair" petit />
            </>
          )}
        </div>
      )}

      {(admin || !decisionEnAttente) && (
        <div className="flex flex-wrap gap-2.5">
          <BoutonAction action={() => approuver(q.id)} libelle={essai ? t("proposerApprobation") : t("approuver")} variante="oui" />
          <button
            type="button"
            aria-expanded={ouvert === "modifier"}
            onClick={() => setOuvert(ouvert === "modifier" ? null : "modifier")}
            className="h-[46px] rounded-bouton border-2 border-contour bg-surface px-5 text-[15px] font-bold text-texte"
          >
            {t("modifierTexte")}
          </button>
          <button
            type="button"
            aria-expanded={ouvert === "refuser"}
            onClick={() => setOuvert(ouvert === "refuser" ? null : "refuser")}
            className="h-[46px] rounded-bouton border-2 border-foret bg-brique px-5 text-[15px] font-bold text-white"
          >
            {essai ? t("proposerRefus") : t("refuser")}
          </button>
        </div>
      )}

      {ouvert === "refuser" && (
        <form action={actionRefus} className="flex flex-col gap-2 rounded-bouton bg-doux p-3">
          <label htmlFor={`motif-${q.id}`} className="text-sm font-bold">
            {t("motifRefus")}
          </label>
          <input id={`motif-${q.id}`} name="motif" required minLength={3} maxLength={300} placeholder={t("motifExemple")} className={champ} />
          <MessageEtat etat={etatRefus} />
          <button type="submit" disabled={refusEnCours} className="h-11 self-start rounded-bouton border-2 border-foret bg-brique px-5 font-bold text-white">
            {t("confirmerRefus")}
          </button>
        </form>
      )}

      {ouvert === "modifier" && (
        <form action={actionModif} className="flex flex-col gap-2.5 rounded-bouton bg-doux p-3">
          <label className="text-sm font-bold">
            {t("question")}
            <textarea name="question" defaultValue={q.question} rows={2} maxLength={200} className={`${champ} mt-1 h-auto py-2`} />
          </label>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <label className="text-sm font-bold">
              {t("categorie")}
              <select name="categorie" defaultValue={q.categorie} className={`${champ} mt-1`}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {LIBELLES_CATEGORIES[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              {t("dateFin")}
              <input type="date" name="date_fin" defaultValue={q.dateFinJour} className={`${champ} mt-1`} />
            </label>
            <label className="text-sm font-bold">
              {t("heureKinshasa")}
              <input type="time" name="heure_fin" defaultValue={q.dateFinHeure} className={`${champ} mt-1`} />
            </label>
          </div>
          <label className="text-sm font-bold">
            {t("sourceChamp")}
            <input name="source" defaultValue={q.source} maxLength={200} className={`${champ} mt-1`} />
          </label>
          <MessageEtat etat={etatModif} />
          <button type="submit" disabled={modifEnCours} className="h-11 self-start rounded-bouton border-2 border-foret bg-foret px-5 font-bold text-white dark:border-vert-jaune">
            {t("enregistrer")}
          </button>
        </form>
      )}
    </article>
  );
}
