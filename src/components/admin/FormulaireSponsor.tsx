"use client";

import { useActionState } from "react";
import { definirSponsor } from "@/app/actions/backoffice";
import type { EtatAction } from "@/app/actions/admin";
import { cls } from "./ui";

// Sponsor d'un marché : la carte affiche « Sponsorisé » et la page « Question offerte par… ». Vide = pas de sponsor.
export function FormulaireSponsor({ marche, sponsor }: { marche: number; sponsor: string | null }) {
  const [etat, action, enCours] = useActionState<EtatAction, FormData>(definirSponsor.bind(null, marche), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="min-w-[220px] flex-1">
        <span className={cls.label}>Sponsor (partenaire)</span>
        <input name="sponsor" defaultValue={sponsor ?? ""} maxLength={60} placeholder="Laisser vide : pas de sponsor" className={`${cls.champ} mt-1`} />
      </label>
      <button type="submit" disabled={enCours} className={cls.secondaire}>
        {enCours ? "…" : "Enregistrer"}
      </button>
      {(etat.erreur || etat.succes) && (
        <span role={etat.erreur ? "alert" : "status"} className={`w-full text-xs font-medium ${etat.erreur ? "text-adm-danger" : "text-adm-accent"}`}>
          {etat.erreur ?? etat.succes}
        </span>
      )}
    </form>
  );
}
