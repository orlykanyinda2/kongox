"use client";

import { useActionState, useState } from "react";
import { approuver, modifier, refuser, validerDecision, type EtatAction } from "@/app/actions/admin";
import { CATEGORIES, LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";
import { BoutonAction } from "./Actions";
import { Pastille, cls } from "./ui";

export type QuestionEnAttente = {
  id: number;
  question: string;
  categorie: Categorie;
  source: string;
  auteur: string | null;
  ageHeures: number;
  finLibelle: string;
  dateFinJour: string;
  dateFinHeure: string;
  decision: { id: number; decision: "approuve" | "refuse"; motif: string | null; curateur: string } | null;
};

function Message({ etat }: { etat: EtatAction }) {
  if (!etat.erreur && !etat.succes) return null;
  return <p className={`text-[13px] font-medium ${etat.erreur ? "text-adm-danger" : "text-adm-accent"}`}>{etat.erreur ?? etat.succes}</p>;
}

// Une ligne de la file d'approbation : Approuver, Modifier le texte, Refuser (avec motif).
export function LigneApprobation({ q, admin, essai }: { q: QuestionEnAttente; admin: boolean; essai: boolean }) {
  const [ouvert, setOuvert] = useState<"modifier" | "refuser" | null>(null);
  const [etatRefus, actionRefus, refusEnCours] = useActionState<EtatAction, FormData>(refuser.bind(null, q.id), {});
  const [etatModif, actionModif, modifEnCours] = useActionState<EtatAction, FormData>(modifier.bind(null, q.id), {});
  const enRetard = q.ageHeures >= 12;

  return (
    <article className="flex flex-col gap-2.5 border-b border-adm-bordure px-4 py-3.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <Pastille>{LIBELLES_CATEGORIES[q.categorie]}</Pastille>
        <Pastille ton={enRetard ? "danger" : "neutre"}>Reçue il y a {q.ageHeures} h</Pastille>
        {q.auteur && <span className="text-adm-secondaire">par @{q.auteur}</span>}
        <span className="text-adm-secondaire">· fin {q.finLibelle} · source : {q.source}</span>
      </div>
      <h2 className="text-[15px] font-semibold">{q.question}</h2>

      {q.decision && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-adm-bordure bg-adm-zone px-3 py-2 text-[13px]">
          <span className="flex-1">
            @{q.decision.curateur} (curateur en essai) propose {q.decision.decision === "approuve" ? "d'approuver" : "de refuser"}
            {q.decision.motif && <> — « {q.decision.motif} »</>}
          </span>
          {admin && (
            <>
              <BoutonAction action={() => validerDecision(q.decision!.id, true)} libelle="Valider" variante="principal" />
              <BoutonAction action={() => validerDecision(q.decision!.id, false)} libelle="Rejeter" />
            </>
          )}
        </div>
      )}

      {(admin || !q.decision) && (
        <div className="flex flex-wrap gap-2">
          <BoutonAction action={() => approuver(q.id)} libelle={essai ? "Proposer d'approuver" : "Approuver"} variante="principal" />
          <button type="button" aria-expanded={ouvert === "modifier"} onClick={() => setOuvert(ouvert === "modifier" ? null : "modifier")} className={cls.secondaire}>
            Modifier le texte
          </button>
          <button type="button" aria-expanded={ouvert === "refuser"} onClick={() => setOuvert(ouvert === "refuser" ? null : "refuser")} className={cls.dangerContour}>
            {essai ? "Proposer de refuser" : "Refuser"}
          </button>
        </div>
      )}

      {ouvert === "refuser" && (
        <form action={actionRefus} className="flex flex-wrap items-end gap-2 rounded-md bg-adm-zone p-3">
          <label className={`${cls.label} min-w-[240px] flex-1`}>
            Motif du refus (visible par l’auteur)
            <input name="motif" required minLength={3} maxLength={300} placeholder="Ex. : réponse impossible à vérifier" className={`${cls.champ} mt-1`} />
          </label>
          <button type="submit" disabled={refusEnCours} className={cls.danger}>
            Confirmer le refus
          </button>
          <div className="w-full">
            <Message etat={etatRefus} />
          </div>
        </form>
      )}

      {ouvert === "modifier" && (
        <form action={actionModif} className="grid gap-2.5 rounded-md bg-adm-zone p-3 sm:grid-cols-4">
          <label className={`${cls.label} sm:col-span-4`}>
            Question
            <input name="question" defaultValue={q.question} maxLength={200} className={`${cls.champ} mt-1`} />
          </label>
          <label className={cls.label}>
            Catégorie
            <select name="categorie" defaultValue={q.categorie} className={`${cls.champ} mt-1`}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {LIBELLES_CATEGORIES[c]}
                </option>
              ))}
            </select>
          </label>
          <label className={cls.label}>
            Date de fin
            <input type="date" name="date_fin" defaultValue={q.dateFinJour} className={`${cls.champ} mt-1`} />
          </label>
          <label className={cls.label}>
            Heure (Kinshasa)
            <input type="time" name="heure_fin" defaultValue={q.dateFinHeure} className={`${cls.champ} mt-1`} />
          </label>
          <label className={cls.label}>
            Source
            <input name="source" defaultValue={q.source} maxLength={200} className={`${cls.champ} mt-1`} />
          </label>
          <div className="flex items-center gap-3 sm:col-span-4">
            <button type="submit" disabled={modifEnCours} className={cls.principal}>
              Enregistrer
            </button>
            <Message etat={etatModif} />
          </div>
        </form>
      )}
    </article>
  );
}
