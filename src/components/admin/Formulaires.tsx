"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  changerRole,
  creerCadeau,
  reinitialiserMotDePasse,
  type EtatAction,
  type EtatMotDePasse,
} from "@/app/actions/admin";
import { MessageEtat } from "./BoutonAction";

const champ = "h-[46px] w-full rounded-bouton border-2 border-contour bg-surface px-3.5 text-[15px] text-texte";

// « Réinitialiser un mot de passe » (maquette Admin, colonne de droite)
export function FormulaireMotDePasse() {
  const t = useTranslations("admin");
  const [etat, action, enCours] = useActionState<EtatMotDePasse, FormData>(reinitialiserMotDePasse, {});
  const [copie, setCopie] = useState(false);

  return (
    <section className="rounded-carte border-2 border-contour bg-surface p-5 shadow-brique-md">
      <h2 className="text-xl">{t("mdpTitre")}</h2>
      <p className="mt-1.5 text-[13px] leading-[1.45] text-texte-secondaire">{t("mdpTexte")}</p>
      <form action={action} className="mt-3 flex flex-col gap-2.5">
        <label htmlFor="nom-reset" className="text-[13px] font-bold">
          {t("nomUtilisateur")}
        </label>
        <input id="nom-reset" name="nom" required placeholder="ex. Kin_la_Belle" autoComplete="off" autoCapitalize="none" className={champ} />
        <button type="submit" disabled={enCours} className="h-[46px] rounded-bouton border-2 border-foret bg-foret font-bold text-white dark:border-vert-jaune">
          {enCours ? "…" : t("genererMdp")}
        </button>
      </form>
      {etat.erreur && <div className="mt-2.5"><MessageEtat etat={etat} /></div>}
      {etat.motDePasse && (
        <div role="status" className="mt-3 flex flex-col gap-2 rounded-bouton border-2 border-foret bg-vert-jaune p-3 text-foret">
          <span className="text-sm">{t("mdpPour", { nom: etat.nom ?? "" })}</span>
          <code className="select-all font-titre text-xl font-bold">{etat.motDePasse}</code>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(etat.motDePasse!);
              setCopie(true);
            }}
            className="h-9 self-start rounded-[10px] border-2 border-foret bg-white px-3 text-xs font-bold"
          >
            {copie ? t("copie") : t("copier")}
          </button>
          <span className="text-xs">{t("mdpConseil")}</span>
        </div>
      )}
    </section>
  );
}

// Créer un cadeau pour un gagnant
export function FormulaireCadeau() {
  const t = useTranslations("admin");
  const [etat, action, enCours] = useActionState<EtatAction, FormData>(creerCadeau, {});
  return (
    <form action={action} className="flex flex-col gap-2.5 rounded-carte border-2 border-contour bg-surface p-5 shadow-decale-md">
      <h2 className="text-xl">{t("nouveauCadeau")}</h2>
      <label className="text-sm font-bold">
        {t("gagnant")}
        <input name="nom" required placeholder="ex. Prono_King243" autoCapitalize="none" className={`${champ} mt-1`} />
      </label>
      <label className="text-sm font-bold">
        {t("typeCadeau")}
        <select name="type" className={`${champ} mt-1`} defaultValue="credit">
          <option value="credit">{t("cadeauType.credit")}</option>
          <option value="forfait_internet">{t("cadeauType.forfait_internet")}</option>
          <option value="produit">{t("cadeauType.produit")}</option>
        </select>
      </label>
      <label className="text-sm font-bold">
        {t("raison")}
        <input name="description" maxLength={200} placeholder={t("raisonExemple")} className={`${champ} mt-1`} />
      </label>
      <MessageEtat etat={etat} />
      <button type="submit" disabled={enCours} className="h-[46px] rounded-bouton border-2 border-foret bg-foret font-bold text-white dark:border-vert-jaune">
        {enCours ? "…" : t("marquerGagnant")}
      </button>
    </form>
  );
}

// Changer le rôle d'un utilisateur
export function FormulaireRole({ utilisateur, role }: { utilisateur: string; role: string }) {
  const t = useTranslations("admin");
  const [etat, action, enCours] = useActionState<EtatAction, FormData>(changerRole.bind(null, utilisateur), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2.5">
      <label className="text-sm font-bold">
        {t("role")}
        <select name="role" defaultValue={role} className={`${champ} mt-1 w-48`}>
          <option value="utilisateur">{t("roles.utilisateur")}</option>
          <option value="curateur">{t("roles.curateur")}</option>
          <option value="admin">{t("roles.admin")}</option>
        </select>
      </label>
      <button type="submit" disabled={enCours} className="h-[46px] rounded-bouton border-2 border-foret bg-foret px-5 font-bold text-white dark:border-vert-jaune">
        {t("enregistrer")}
      </button>
      <div className="w-full">
        <MessageEtat etat={etat} />
      </div>
    </form>
  );
}
