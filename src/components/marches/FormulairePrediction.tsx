"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { predire, type EtatPrediction } from "@/app/actions/marches";
import type { OptionMarche } from "@/lib/marches/donnees";
import { IconePiece } from "@/components/IconePiece";
import { formaterNombre } from "@/lib/format";

type Props = {
  marcheId: number;
  options: OptionMarche[]; // [OUI, NON]
  pourcentageOui: number;
  solde: number;
  restant: number; // pièces qu'on peut encore miser aujourd'hui
};

const MONTANTS = [50, 100, 200, 500];

// Panneau Hunter Green pour prédire (maquette Marche).
// Le gain affiché est une estimation pour aider à choisir ; les pièces ne bougent que par la fonction SQL.
export function FormulairePrediction({ marcheId, options, pourcentageOui, solde, restant }: Props) {
  const t = useTranslations("prediction");
  const choixUrl = useSearchParams().get("choix");
  const [ordre, setOrdre] = useState(choixUrl === "non" ? 1 : 0);
  const [saisie, setSaisie] = useState("200");
  const [etat, action, enCours] = useActionState<EtatPrediction, FormData>(predire, {});

  const option = options[ordre];
  const montant = Number.parseInt(saisie, 10) || 0;
  const maximum = Math.min(solde, restant);
  const total = options.reduce((s, o) => s + o.total_mise, 0);
  // Estimation : ma part de la cagnotte si la cagnotte ne bouge plus
  const gain = montant > 0 ? Math.floor((montant * (total + montant)) / (option.total_mise + montant)) : 0;

  let blocage: string | null = null;
  if (restant <= 0) blocage = t("limiteAtteinte");
  else if (montant < 10) blocage = t("minimum");
  else if (montant > solde) blocage = t("soldeInsuffisant", { solde: formaterNombre(solde) });
  else if (montant > restant) blocage = t("depasseLimite", { restant: formaterNombre(restant) });

  const pcts = [pourcentageOui, 100 - pourcentageOui];
  const choix = (o: number) => {
    const actif = o === ordre;
    const couleurs = o === 0 ? "bg-vert-jaune text-foret" : "bg-brique text-white";
    const etatVisuel = actif ? "border-[3px] border-champagne shadow-[4px_4px_0_#1F3A26]" : "border-[3px] border-transparent opacity-75";
    return (
      <button
        type="button"
        aria-pressed={actif}
        onClick={() => setOrdre(o)}
        className={`h-14 rounded-champ text-[17px] font-bold ${couleurs} ${etatVisuel}`}
      >
        {options[o].libelle} · {pcts[o]} %
      </button>
    );
  };

  return (
    <form
      action={action}
      aria-label={t("titre")}
      className="flex flex-col gap-3.5 rounded-carte border-2 border-foret bg-hunter p-[18px] text-white shadow-brique-md"
    >
      <input type="hidden" name="marche" value={marcheId} />
      <input type="hidden" name="option" value={option.id} />
      <input type="hidden" name="libelle" value={option.libelle} />

      <div role="group" aria-label={t("choisirOuiNon")} className="grid grid-cols-2 gap-2">
        {choix(0)}
        {choix(1)}
      </div>

      <div>
        <label htmlFor="mise" className="block text-[13px] font-semibold text-[#E4EAD3]">
          {t("combien")}
        </label>
        <div className="mt-1.5 flex h-14 items-center gap-2.5 rounded-champ border border-sauge bg-[#2A4A31] px-4 focus-within:ring-4 focus-within:ring-vert-jaune/50">
          <IconePiece taille={22} />
          <input
            id="mise"
            name="montant"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
            aria-describedby="mise-aide"
            className="min-w-0 flex-1 border-0 bg-transparent font-titre text-[26px] font-bold text-white outline-none"
          />
          <span className="text-[13px] text-[#C9D4B8]">{t("pieces")}</span>
        </div>
        <p id="mise-aide" className="mt-1.5 text-xs text-[#C9D4B8]">
          {t("aide", { solde: formaterNombre(solde), restant: formaterNombre(Math.max(restant, 0)) })}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {MONTANTS.map((v) => {
          const actif = montant === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={actif}
              disabled={v > maximum}
              onClick={() => setSaisie(String(v))}
              className={`h-11 rounded-[10px] text-sm font-bold disabled:opacity-40 ${actif ? "bg-vert-jaune text-foret" : "bg-[#2A4A31] text-white"}`}
            >
              {v}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between text-sm text-[#E4EAD3]">
        <span>{t("gainPossible")}</span>
        <span className="font-bold text-vert-jaune">≈ {formaterNombre(gain)} {t("pieces")}</span>
      </div>

      {(blocage || etat.erreur) && (
        <p role="alert" className="rounded-bouton bg-brique px-3 py-2.5 text-sm font-semibold text-white">
          {etat.erreur ?? blocage}
        </p>
      )}
      {etat.succes && !etat.erreur && (
        <p role="status" className="rounded-bouton bg-vert-jaune px-3 py-2.5 text-sm font-semibold text-foret">
          {t("succes", {
            montant: formaterNombre(etat.succes.montant),
            libelle: etat.succes.libelle,
            restant: formaterNombre(etat.succes.restant),
          })}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours || blocage !== null}
        className="h-14 rounded-champ bg-vert-jaune text-[17px] font-bold text-foret disabled:opacity-60"
      >
        {enCours ? t("envoi") : t("valider", { libelle: option.libelle, montant: formaterNombre(montant) })}
      </button>
      <span className="text-center text-xs text-[#C9D4B8]">{t("mention")}</span>
    </form>
  );
}
