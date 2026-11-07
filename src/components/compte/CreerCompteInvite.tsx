"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { creerCompteDepuisInvite, type EtatInvite } from "@/app/actions/invite";

// L'invité choisit un mot de passe : son compte garde le même pseudo, les mêmes votes et les mêmes pièces,
// et reçoit les pièces d'inscription en plus.
export function CreerCompteInvite({ nom, pieces }: { nom: string; pieces: number }) {
  const t = useTranslations("invite");
  const [etat, action, enCours] = useActionState<EtatInvite, FormData>(creerCompteDepuisInvite, {});
  const champ = "h-12 w-full rounded-champ border-2 border-foret bg-white px-3.5 text-[15px] text-foret";

  if (etat.succes) {
    return (
      <p role="status" className="rounded-carte border-2 border-foret bg-vert-jaune p-5 text-[15px] font-bold text-foret">
        {t("bienvenue", { nom: etat.nom ?? nom })}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-carte border-2 border-foret bg-hunter p-5 text-white shadow-brique-md">
      <h2 className="text-xl">{t("conversionTitre")}</h2>
      <p className="text-[15px] text-[#E4EAD3]">{t("conversionTexte", { nom, pieces })}</p>
      <form action={action} className="flex flex-col gap-2.5">
        <label className="text-sm font-bold">
          {t("motDePasse")}
          <input name="mot_de_passe" type="password" required minLength={6} maxLength={72} autoComplete="new-password" className={`${champ} mt-1`} />
        </label>
        <label className="text-sm font-bold">
          {t("confirmation")}
          <input name="confirmation" type="password" required minLength={6} maxLength={72} autoComplete="new-password" className={`${champ} mt-1`} />
        </label>
        {etat.erreur && (
          <p role="alert" className="rounded-champ bg-white px-3 py-2 text-sm font-bold text-brique">
            {etat.erreur}
          </p>
        )}
        <button type="submit" disabled={enCours} className="flex h-14 items-center justify-center rounded-champ bg-vert-jaune text-[17px] font-bold text-foret disabled:opacity-60">
          {enCours ? t("patiente") : t("valider", { pieces })}
        </button>
      </form>
    </section>
  );
}
