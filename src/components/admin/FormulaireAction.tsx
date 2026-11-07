"use client";

import { useActionState, type ReactNode } from "react";
import type { EtatAction } from "@/app/actions/admin";
import { cls } from "./ui";

// Formulaire générique du back-office : champs fournis par la page (serveur), bouton, message de retour
export function FormulaireAction({
  action,
  bouton,
  children,
  className = "flex flex-wrap items-end gap-2",
}: {
  action: (etat: EtatAction, donnees: FormData) => Promise<EtatAction>;
  bouton: string;
  children: ReactNode;
  className?: string;
}) {
  const [etat, envoyer, enCours] = useActionState<EtatAction, FormData>(action, {});
  return (
    <form action={envoyer} className={className}>
      {children}
      <button type="submit" disabled={enCours} className={cls.principal}>
        {enCours ? "…" : bouton}
      </button>
      {(etat.erreur || etat.succes) && (
        <span role={etat.erreur ? "alert" : "status"} className={`w-full text-xs font-medium ${etat.erreur ? "text-adm-danger" : "text-adm-accent"}`}>
          {etat.erreur ?? etat.succes}
        </span>
      )}
    </form>
  );
}
