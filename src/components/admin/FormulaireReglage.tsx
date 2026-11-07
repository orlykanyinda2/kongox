"use client";

import { useActionState } from "react";
import { modifierReglage } from "@/app/actions/backoffice";
import type { EtatAction } from "@/app/actions/admin";
import { cls } from "./ui";

// Un réglage : valeur + bouton Enregistrer, avec les limites autorisées
export function FormulaireReglage({ cle, valeur, numerique, minimum, maximum }: { cle: string; valeur: string; numerique: boolean; minimum: number | null; maximum: number | null }) {
  const [etat, action, enCours] = useActionState<EtatAction, FormData>(modifierReglage.bind(null, cle, numerique), {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        name="valeur"
        defaultValue={valeur}
        aria-label={cle}
        type={numerique ? "number" : "text"}
        inputMode={numerique ? "numeric" : "tel"}
        min={minimum ?? undefined}
        max={maximum ?? undefined}
        className={`${cls.champ} w-40 text-right tabular-nums`}
      />
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
