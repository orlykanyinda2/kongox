"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { creerMarcheAdmin, modifierMarcheAdmin, type EtatCreation } from "@/app/actions/backoffice";
import type { EtatAction } from "@/app/actions/admin";
import { CATEGORIES, LIBELLES_CATEGORIES } from "@/lib/marches/categories";
import { cls } from "./ui";

type Valeurs = {
  question: string;
  categorie: string;
  source: string;
  finDate: string;
  finHeure: string;
  pubDate: string;
  pubHeure: string;
  misEnAvant: boolean;
  soki: boolean;
};

type Props =
  | { mode: "creation"; valeurs: Valeurs }
  | { mode: "modification"; marche: number; valeurs: Valeurs; verrouille: boolean; statut: string };

// Créer ou modifier un marché. Après une première mise, seuls la date de fin et la mise en avant changent.
export function FormulaireMarche(props: Props) {
  const router = useRouter();
  const v = props.valeurs;
  const creation = props.mode === "creation";
  const verrouille = !creation && props.verrouille;
  const publicationModifiable = creation || props.statut === "brouillon" || props.statut === "programme";
  const [etat, setEtat] = useState(creation ? "brouillon" : "");

  const [resultat, action, enCours] = useActionState<EtatCreation | EtatAction, FormData>(
    creation ? creerMarcheAdmin : modifierMarcheAdmin.bind(null, props.marche),
    {},
  );

  useEffect(() => {
    if (creation && "id" in resultat && resultat.id) router.push(`/admin/marches/${resultat.id}`);
  }, [creation, resultat, router]);

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-4">
      {verrouille && (
        <p className="rounded-md border border-[#eedfb8] bg-[#fbf4e4] px-3 py-2 text-[13px]">
          Des pièces sont déjà misées : la question, la catégorie et la source sont verrouillées. Pour les changer, supprime le marché
          (les mises sont remboursées) puis recrée-le.
        </p>
      )}
      <label className={cls.label}>
        Question
        <textarea name="question" defaultValue={v.question} required minLength={15} maxLength={200} rows={2} readOnly={verrouille} className={`${cls.zoneTexte} mt-1 read-only:bg-adm-zone`} />
        <span className={cls.aide}>15 à 200 caractères, réponse OUI ou NON vérifiable, terminée par « ? ».</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={cls.label}>
          Catégorie
          {verrouille ? (
            <>
              <input type="hidden" name="categorie" value={v.categorie} />
              <input readOnly value={LIBELLES_CATEGORIES[v.categorie as keyof typeof LIBELLES_CATEGORIES]} className={`${cls.champ} mt-1 bg-adm-zone`} />
            </>
          ) : (
            <select name="categorie" defaultValue={v.categorie} className={`${cls.champ} mt-1`}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {LIBELLES_CATEGORIES[c]}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className={cls.label}>
          Source de la réponse
          <input name="source" defaultValue={v.source} required minLength={3} maxLength={200} readOnly={verrouille} className={`${cls.champ} mt-1 read-only:bg-adm-zone`} />
        </label>
      </div>

      {creation && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className={cls.label}>Publication</legend>
          <div className="mt-1 flex flex-wrap gap-4 text-sm">
            {[
              ["brouillon", "Brouillon (non publié)"],
              ["programme", "Programmer à une date"],
              ["en_ligne", "En ligne tout de suite"],
            ].map(([val, lib]) => (
              <label key={val} className="flex items-center gap-1.5">
                <input type="radio" name="etat" value={val} checked={etat === val} onChange={() => setEtat(val)} className="accent-adm-accent" />
                {lib}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {publicationModifiable && (creation ? etat !== "en_ligne" : true) && (
          <div>
            <span className={cls.label}>Date et heure de publication (Kinshasa)</span>
            <div className="mt-1 flex gap-2">
              <input type="date" name="pub_date" defaultValue={v.pubDate} aria-label="Date de publication" required={etat === "programme"} className={cls.champ} />
              <input type="time" name="pub_heure" defaultValue={v.pubHeure || "08:00"} aria-label="Heure de publication" className={`${cls.champ} w-32`} />
            </div>
          </div>
        )}
        <div>
          <span className={cls.label}>Date et heure de fermeture (Kinshasa)</span>
          <div className="mt-1 flex gap-2">
            <input type="date" name="fin_date" defaultValue={v.finDate} aria-label="Date de fermeture" required className={cls.champ} />
            <input type="time" name="fin_heure" defaultValue={v.finHeure || "20:00"} aria-label="Heure de fermeture" className={`${cls.champ} w-32`} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="mis_en_avant" defaultChecked={v.misEnAvant} className="accent-adm-accent" />
          Mettre en avant (en tête de la liste sur l’accueil)
        </label>
        {publicationModifiable && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="soki" defaultChecked={v.soki} className="accent-adm-accent" />
            Devient le « Soki du jour » à sa publication
          </label>
        )}
      </div>

      {(resultat.erreur || resultat.succes) && (
        <p role={resultat.erreur ? "alert" : "status"} className={`text-[13px] font-medium ${resultat.erreur ? "text-adm-danger" : "text-adm-accent"}`}>
          {resultat.erreur ?? resultat.succes}
        </p>
      )}
      <div>
        <button type="submit" disabled={enCours} className={cls.principal}>
          {enCours ? "…" : creation ? "Créer le marché" : "Enregistrer les modifications"}
        </button>
      </div>
    </form>
  );
}
