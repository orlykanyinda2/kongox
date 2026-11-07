"use client";

import { useState, useTransition } from "react";
import type { EtatSocial } from "@/app/actions/social";

type Props = {
  action: (valeur: boolean) => Promise<EtatSocial>;
  actif: boolean;
  libelleActif: string; // ex. « Abonné »
  libelleInactif: string; // ex. « Suivre »
  petit?: boolean;
};

// Bouton à bascule (Suivre / Abonné, Rejoindre / Membre) appelant une Server Action
export function BoutonSocial({ action, actif: initial, libelleActif, libelleInactif, petit = false }: Props) {
  const [actif, setActif] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        aria-pressed={actif}
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            const r = await action(!actif);
            if (r.erreur) setErreur(r.erreur);
            else {
              setErreur(null);
              setActif(Boolean(r.actif));
            }
          })
        }
        className={`rounded-champ border-2 border-foret font-bold disabled:opacity-60 ${petit ? "h-10 px-3.5 text-sm" : "h-12 px-[22px] text-[15px]"} ${
          actif ? "bg-surface text-texte" : "bg-foret text-white shadow-[4px_4px_0_#A7C957] dark:border-vert-jaune"
        }`}
      >
        {enCours ? "…" : actif ? libelleActif : libelleInactif}
      </button>
      {erreur && (
        <span role="alert" className="text-xs font-semibold text-brique">
          {erreur}
        </span>
      )}
    </span>
  );
}
