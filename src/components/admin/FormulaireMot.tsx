"use client";

import { useActionState } from "react";
import { ajouterMotInterdit } from "@/app/actions/moderation";
import type { EtatAction } from "@/app/actions/admin";
import { cls } from "./ui";

// Ajout d'un mot interdit (comparé sans accents ni majuscules, mot entier)
export function FormulaireMot() {
  const [etat, action, enCours] = useActionState<EtatAction, FormData>(ajouterMotInterdit, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="flex-1">
        <span className={cls.label}>Nouveau mot ou expression</span>
        <input name="mot" required minLength={2} maxLength={40} className={`${cls.champ} mt-1`} placeholder="ex. un mot en lingala" />
      </label>
      <button type="submit" disabled={enCours} className={cls.principal}>
        {enCours ? "…" : "Ajouter"}
      </button>
      {(etat.erreur || etat.succes) && (
        <span role={etat.erreur ? "alert" : "status"} className={`w-full text-xs font-medium ${etat.erreur ? "text-adm-danger" : "text-adm-accent"}`}>
          {etat.erreur ?? etat.succes}
        </span>
      )}
    </form>
  );
}
