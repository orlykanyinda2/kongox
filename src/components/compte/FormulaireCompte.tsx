"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { connecter, inscrire, type EtatFormulaire } from "@/app/actions/compte";
import { nomDrole } from "@/lib/compte/nomsDroles";
import { MDP_LONGUEUR_MAX, MDP_LONGUEUR_MIN } from "@/lib/compte/nomUtilisateur";

type Mode = "inscription" | "connexion";

const champ =
  "mt-1.5 h-12 w-full min-w-0 rounded-bouton border-2 border-contour bg-surface px-3.5 text-base text-texte outline-none focus-visible:ring-4 focus-visible:ring-vert-jaune/60";

// Formulaire « Créer un compte / Se connecter » (maquettes/Inscription.dc.html)
export function FormulaireCompte({ modeInitial }: { modeInitial: Mode }) {
  const t = useTranslations("compte");
  const [mode, setMode] = useState<Mode>(modeInitial);
  const inscription = mode === "inscription";

  const [etatInscription, actionInscription, enCoursInscription] = useActionState<EtatFormulaire, FormData>(inscrire, {});
  const [etatConnexion, actionConnexion, enCoursConnexion] = useActionState<EtatFormulaire, FormData>(connecter, {});
  const etat = inscription ? etatInscription : etatConnexion;
  const enCours = inscription ? enCoursInscription : enCoursConnexion;

  // Nom proposé : le premier nom drôle à l'inscription, vide à la connexion
  const [indexNom, setIndexNom] = useState(0);
  const [nom, setNom] = useState(modeInitial === "inscription" ? nomDrole(0) : "");

  function changerMode(nouveau: Mode) {
    setMode(nouveau);
    // Change l'adresse sans recharger la page (lien partageable)
    window.history.replaceState(null, "", nouveau === "inscription" ? "/inscription" : "/connexion");
  }

  function suggerer() {
    const suivant = indexNom + 1;
    setIndexNom(suivant);
    setNom(nomDrole(suivant));
  }

  const onglet = (actif: boolean) =>
    `h-11 rounded-[10px] text-[15px] font-bold ${actif ? "bg-foret text-white dark:bg-vert-jaune dark:text-foret" : "bg-transparent text-texte"}`;

  return (
    <>
      <div role="tablist" aria-label={t("ongletsLibelle")} className="mt-2 grid grid-cols-2 rounded-champ border-2 border-contour bg-doux p-1">
        <button type="button" role="tab" aria-selected={inscription} onClick={() => changerMode("inscription")} className={onglet(inscription)}>
          {t("creerCompte")}
        </button>
        <button type="button" role="tab" aria-selected={!inscription} onClick={() => changerMode("connexion")} className={onglet(!inscription)}>
          {t("seConnecter")}
        </button>
      </div>

      <form
        action={inscription ? actionInscription : actionConnexion}
        className="flex flex-col gap-3.5 rounded-carte border-2 border-contour bg-surface p-[18px] shadow-decale-md"
        noValidate
      >
        <div>
          <label htmlFor="nom" className="block text-sm font-bold">
            {t("nomUtilisateur")}
          </label>
          <div className="flex gap-2">
            <input
              id="nom"
              name="nom"
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_]{3,24}"
              aria-describedby="aide-nom"
              className={`${champ} font-semibold`}
            />
            {inscription && (
              <button
                type="button"
                onClick={suggerer}
                aria-label={t("suggererNom")}
                className="mt-1.5 flex size-12 flex-none items-center justify-center rounded-bouton border-2 border-foret bg-vert-jaune text-foret"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              </button>
            )}
          </div>
          <p id="aide-nom" className="mt-1.5 text-xs text-texte-secondaire">
            {inscription ? t("aideNomInscription") : t("aideNomConnexion")}
          </p>
        </div>

        <div>
          <label htmlFor="mot_de_passe" className="block text-sm font-bold">
            {t("motDePasse")}
          </label>
          <input
            id="mot_de_passe"
            name="mot_de_passe"
            type="password"
            autoComplete={inscription ? "new-password" : "current-password"}
            required
            minLength={inscription ? MDP_LONGUEUR_MIN : undefined}
            maxLength={MDP_LONGUEUR_MAX}
            className={champ}
          />
          {inscription && <p className="mt-1.5 text-xs text-texte-secondaire">{t("aideMotDePasse", { min: MDP_LONGUEUR_MIN })}</p>}
        </div>

        {inscription && (
          <div>
            <label htmlFor="confirmation" className="block text-sm font-bold">
              {t("confirmation")}
            </label>
            <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required maxLength={MDP_LONGUEUR_MAX} className={champ} />
          </div>
        )}

        {etat.erreur && (
          <p role="alert" className="rounded-bouton border-2 border-brique bg-brique/10 px-3 py-2.5 text-sm font-semibold text-texte">
            {etat.erreur}
          </p>
        )}

        <button
          type="submit"
          disabled={enCours}
          className="h-[54px] rounded-champ border-2 border-foret bg-foret text-base font-bold text-white shadow-[4px_4px_0_#A7C957] disabled:opacity-70 dark:border-vert-jaune"
        >
          {enCours ? t("patiente") : inscription ? t("boutonInscription") : t("boutonConnexion")}
        </button>

        {inscription && <p className="text-[13px] leading-[1.45] text-texte-secondaire">{t("pasBesoinEmail")}</p>}
      </form>
    </>
  );
}
