"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { voterEnInvite, type EtatInvite } from "@/app/actions/invite";
import { nomDrole } from "@/lib/compte/nomsDroles";

// Panneau des visiteurs sur un marché ouvert : voter tout de suite avec un pseudo (pièces d'essai),
// ou créer un compte, ou se connecter. Après « Voter », la page se recharge avec le formulaire de prédiction.
export function VoterEnInvite({ piecesEssai, piecesCompte, suggestion }: { piecesEssai: number; piecesCompte: number; suggestion: string }) {
  const t = useTranslations("invite");
  const [etat, action, enCours] = useActionState<EtatInvite, FormData>(voterEnInvite, {});
  // Nom drôle tiré au hasard par le serveur (même valeur au premier affichage côté navigateur)
  const [nom, setNom] = useState(etat.nom ?? suggestion);
  const [index, setIndex] = useState(5);

  return (
    <section className="flex flex-col gap-3.5 rounded-carte border-2 border-foret bg-hunter p-5 text-white shadow-brique-md">
      <h2 className="text-xl">{t("titre")}</h2>
      <p className="text-[15px] text-[#E4EAD3]">{t("texte", { pieces: piecesEssai })}</p>
      <form action={action} className="flex flex-col gap-2">
        <label htmlFor="pseudo-invite" className="text-sm font-bold">
          {t("pseudo")}
        </label>
        <div className="flex gap-2">
          <input
            id="pseudo-invite"
            name="nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_]{3,24}"
            autoCapitalize="none"
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-champ border-2 border-foret bg-white px-3.5 text-[15px] font-semibold text-foret"
          />
          <button
            type="button"
            onClick={() => {
              setIndex(index + 1);
              setNom(nomDrole(index + 1 + Math.floor(Math.random() * 1000)));
            }}
            aria-label={t("autreNom")}
            className="flex size-12 flex-none items-center justify-center rounded-champ border-2 border-foret bg-vert-jaune text-foret"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        </div>
        {etat.erreur && (
          <p role="alert" className="rounded-champ bg-white px-3 py-2 text-sm font-bold text-brique">
            {etat.erreur}
          </p>
        )}
        <button type="submit" disabled={enCours} className="mt-1 flex h-14 items-center justify-center rounded-champ bg-vert-jaune text-[17px] font-bold text-foret disabled:opacity-60">
          {enCours ? t("patiente") : t("voter", { pieces: piecesEssai })}
        </button>
        <p className="text-xs text-[#E4EAD3]">{t("public")}</p>
      </form>
      <div className="flex flex-col gap-1.5 border-t border-white/20 pt-3 text-center text-sm">
        <Link href="/inscription" className="font-bold underline">
          {t("ouCompte", { pieces: piecesCompte })}
        </Link>
        <Link href="/connexion" className="underline">
          {t("dejaCompte")}
        </Link>
      </div>
    </section>
  );
}
