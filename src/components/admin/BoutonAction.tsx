"use client";

import { useState, useTransition } from "react";
import type { EtatAction } from "@/app/actions/admin";

const VARIANTES = {
  oui: "border-foret bg-vert-jaune text-foret",
  non: "border-foret bg-brique text-white",
  sombre: "border-foret bg-foret text-white dark:border-vert-jaune",
  clair: "border-contour bg-surface text-texte",
} as const;

type Props = {
  action: () => Promise<EtatAction>;
  libelle: string;
  variante?: keyof typeof VARIANTES;
  confirmation?: string; // message de confirmation avant d'agir
  petit?: boolean;
};

// Bouton qui appelle une Server Action et affiche le résultat juste en dessous.
export function BoutonAction({ action, libelle, variante = "clair", confirmation, petit = false }: Props) {
  const [enCours, demarrer] = useTransition();
  const [etat, setEtat] = useState<EtatAction>({});

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={enCours}
        onClick={() => {
          if (confirmation && !window.confirm(confirmation)) return;
          demarrer(async () => setEtat(await action()));
        }}
        className={`rounded-bouton border-2 font-bold disabled:opacity-60 ${petit ? "h-9 px-2.5 text-xs" : "h-[46px] px-5 text-[15px]"} ${VARIANTES[variante]}`}
      >
        {enCours ? "…" : libelle}
      </button>
      {(etat.erreur || etat.succes) && (
        <span role={etat.erreur ? "alert" : "status"} className={`text-xs font-semibold ${etat.erreur ? "text-brique" : "text-hunter dark:text-vert-jaune"}`}>
          {etat.erreur ?? etat.succes}
        </span>
      )}
    </span>
  );
}

export function MessageEtat({ etat }: { etat: EtatAction }) {
  if (!etat.erreur && !etat.succes) return null;
  return (
    <p
      role={etat.erreur ? "alert" : "status"}
      className={`rounded-bouton px-3 py-2 text-sm font-semibold ${etat.erreur ? "bg-brique text-white" : "bg-vert-jaune text-foret"}`}
    >
      {etat.erreur ?? etat.succes}
    </p>
  );
}
