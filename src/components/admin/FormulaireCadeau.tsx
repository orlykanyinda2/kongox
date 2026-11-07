"use client";

import { useActionState } from "react";
import { creerCadeau, type EtatAction } from "@/app/actions/admin";
import { cls } from "./ui";

// Marquer un gagnant (cadeau envoyé ensuite à la main par l'équipe)
export function FormulaireCadeau() {
  const [etat, action, enCours] = useActionState<EtatAction, FormData>(creerCadeau, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <label className={cls.label}>
        Gagnant (nom d&apos;utilisateur)
        <input name="nom" required autoCapitalize="none" className={`${cls.champ} mt-1`} />
      </label>
      <label className={cls.label}>
        Cadeau
        <select name="type" defaultValue="credit" className={`${cls.champ} mt-1`}>
          <option value="credit">Crédit</option>
          <option value="forfait_internet">Forfait internet</option>
          <option value="produit">Produit</option>
        </select>
      </label>
      <label className={`${cls.label} sm:col-span-2`}>
        Raison
        <input name="description" maxLength={200} placeholder="Ex. : top 3 de la semaine" className={`${cls.champ} mt-1`} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-4">
        <button type="submit" disabled={enCours} className={cls.principal}>
          Ajouter à la liste
        </button>
        {(etat.erreur || etat.succes) && (
          <span role={etat.erreur ? "alert" : "status"} className={`text-[13px] font-medium ${etat.erreur ? "text-adm-danger" : "text-adm-accent"}`}>
            {etat.erreur ?? etat.succes}
          </span>
        )}
      </div>
    </form>
  );
}
