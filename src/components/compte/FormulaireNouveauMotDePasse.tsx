"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { changerMotDePasse, type EtatFormulaire } from "@/app/actions/compte";
import { MDP_LONGUEUR_MAX, MDP_LONGUEUR_MIN } from "@/lib/compte/nomUtilisateur";

const champ = "mt-1 h-12 w-full rounded-bouton border-2 border-contour bg-surface px-3.5 text-[15px] text-texte";

// Changer son mot de passe (utile après une réinitialisation par un admin)
export function FormulaireNouveauMotDePasse() {
  const t = useTranslations("profil");
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(changerMotDePasse, {});
  return (
    <form action={action} className="mt-3.5 flex flex-col gap-2.5">
      <label className="text-[13px] font-bold">
        {t("nouveauMdp")}
        <input name="mot_de_passe" type="password" autoComplete="new-password" required minLength={MDP_LONGUEUR_MIN} maxLength={MDP_LONGUEUR_MAX} className={champ} />
      </label>
      <label className="text-[13px] font-bold">
        {t("confirmerMdp")}
        <input name="confirmation" type="password" autoComplete="new-password" required maxLength={MDP_LONGUEUR_MAX} className={champ} />
      </label>
      <button type="submit" disabled={enCours} className="h-12 rounded-bouton border-2 border-foret bg-foret font-bold text-white disabled:opacity-70 dark:border-vert-jaune">
        {enCours ? t("enregistrement") : t("changerMdp")}
      </button>
      <p aria-live="polite" className={`min-h-5 text-[13px] font-semibold ${etat.erreur ? "text-brique" : ""}`}>
        {etat.erreur ?? etat.succes ?? ""}
      </p>
    </form>
  );
}
