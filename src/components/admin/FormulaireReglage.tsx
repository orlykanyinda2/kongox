"use client";

import { useActionState } from "react";
import { modifierReglage, modifierReglageFil } from "@/app/actions/backoffice";
import type { EtatAction } from "@/app/actions/admin";
import { cls } from "./ui";

type Props = {
  cle: string;
  valeur: string;
  numerique: boolean;
  minimum: number | null;
  maximum: number | null;
  fil?: boolean; // réglage du fil de marchés (table reglages_fil, décimales permises)
  choix?: { valeur: string; libelle: string }[]; // liste au lieu d'un champ (ex. Affichée / Cachée)
};

// Un réglage : valeur + bouton Enregistrer, avec les limites autorisées
export function FormulaireReglage({ cle, valeur, numerique, minimum, maximum, fil = false, choix }: Props) {
  const [etat, action, enCours] = useActionState<EtatAction, FormData>(
    fil ? modifierReglageFil.bind(null, cle) : modifierReglage.bind(null, cle, numerique),
    {},
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      {choix ? (
        <select name="valeur" defaultValue={valeur} aria-label={cle} className={`${cls.champ} w-40`}>
          {choix.map((c) => (
            <option key={c.valeur} value={c.valeur}>
              {c.libelle}
            </option>
          ))}
        </select>
      ) : (
        <input
          name="valeur"
          defaultValue={valeur}
          aria-label={cle}
          type={numerique ? "number" : "text"}
          inputMode={numerique ? (fil ? "decimal" : "numeric") : "tel"}
          step={fil ? "any" : undefined}
          min={minimum ?? undefined}
          max={maximum ?? undefined}
          className={`${cls.champ} w-40 text-right tabular-nums`}
        />
      )}
      <button type="submit" disabled={enCours} className={cls.secondaire}>
        {enCours ? "…" : "Enregistrer"}
      </button>
      {(etat.erreur || etat.succes) && (
        <span role={etat.erreur ? "alert" : "status"} className={`text-xs font-medium ${etat.erreur ? "text-adm-danger" : "text-adm-accent"}`}>
          {etat.erreur ?? etat.succes}
        </span>
      )}
    </form>
  );
}
