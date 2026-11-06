"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { reclamerBonus, type ResultatBonus } from "@/app/actions/compte";
import { jourKinshasa } from "@/lib/format";

// Réclame le bonus quotidien une fois par jour et par compte, puis affiche un message.
// Le calcul des pièces est fait par la fonction SQL reclamer_bonus_quotidien() : ici on ne fait qu'afficher.
export function BonusQuotidien({ utilisateurId }: { utilisateurId: string }) {
  const t = useTranslations("bonus");
  const [resultat, setResultat] = useState<ResultatBonus | null>(null);

  useEffect(() => {
    const cle = `kongox-bonus-${utilisateurId}`;
    const aujourdhui = jourKinshasa();
    try {
      if (localStorage.getItem(cle) === aujourdhui) return;
    } catch {
      // localStorage indisponible : on demande quand même, la base refuse les doublons
    }
    let actif = true;
    reclamerBonus().then((r) => {
      if (!r) return;
      try {
        localStorage.setItem(cle, aujourdhui);
      } catch {}
      if (actif && r.accorde) setResultat(r);
    });
    return () => {
      actif = false;
    };
  }, [utilisateurId]);

  if (!resultat) return null;

  return (
    <div role="status" className="flex animate-bulle items-center gap-3 rounded-carte border-2 border-foret bg-vert-jaune p-4 text-foret shadow-brique">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
      <p className="flex-1 text-[15px] font-semibold leading-snug">
        {t("recu", { bonus: resultat.bonus })}{" "}
        {resultat.bonus_serie > 0 ? t("serieBonus", { jours: resultat.serie_jours, bonus: resultat.bonus_serie }) : t("serie", { jours: resultat.serie_jours })}
      </p>
      <button type="button" onClick={() => setResultat(null)} aria-label={t("fermer")} className="flex size-11 flex-none items-center justify-center rounded-bouton">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
