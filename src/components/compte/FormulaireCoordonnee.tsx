"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { mettreAJourCoordonnees, type EtatFormulaire } from "@/app/actions/compte";

type Props = {
  champ: "telephone" | "email_contact";
  valeur: string | null;
  libelle: string;
  placeholder: string;
  sombre?: boolean; // sur le bloc Hunter Green « Reçois tes cadeaux »
};

// Petit formulaire pour enregistrer le téléphone ou l'e-mail de contact (facultatifs).
export function FormulaireCoordonnee({ champ, valeur, libelle, placeholder, sombre = false }: Props) {
  const t = useTranslations("profil");
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(mettreAJourCoordonnees, {});
  const id = `champ-${champ}`;

  return (
    <form action={action} className="mt-3.5">
      <label htmlFor={id} className="block text-[13px] font-bold">
        {libelle}
      </label>
      <input
        id={id}
        name={champ}
        type={champ === "telephone" ? "tel" : "email"}
        inputMode={champ === "telephone" ? "tel" : "email"}
        autoComplete={champ === "telephone" ? "tel" : "email"}
        defaultValue={valeur ?? ""}
        placeholder={placeholder}
        maxLength={champ === "telephone" ? 20 : 254}
        className="mt-1.5 h-12 w-full rounded-bouton border-2 border-foret bg-white px-3.5 text-[15px] text-foret outline-none focus-visible:ring-4 focus-visible:ring-vert-jaune/60"
      />
      <button
        type="submit"
        disabled={enCours}
        className={`mt-3 h-12 w-full rounded-bouton border-2 border-foret text-[15px] font-bold disabled:opacity-70 ${
          sombre ? "bg-vert-jaune text-foret" : "bg-foret text-white dark:bg-vert-jaune dark:text-foret"
        }`}
      >
        {enCours ? t("enregistrement") : t("enregistrer")}
      </button>
      <p aria-live="polite" className={`mt-2 min-h-5 text-[13px] font-semibold ${sombre ? "text-champagne" : ""}`}>
        {etat.erreur ?? etat.succes ?? ""}
      </p>
    </form>
  );
}
