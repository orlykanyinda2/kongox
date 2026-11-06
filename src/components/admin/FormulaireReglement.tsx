"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { annuler, regler, type EtatAction } from "@/app/actions/admin";
import { MessageEtat } from "./BoutonAction";

type Option = { id: number; libelle: string; total_mise: number };

const champ = "h-11 w-full rounded-bouton border-2 border-contour bg-surface px-3 text-[15px] text-texte";

// Régler un marché : choisir la bonne réponse + lien de la source. Ou l'annuler (tout le monde remboursé).
export function FormulaireReglement({ marche, options }: { marche: number; options: Option[] }) {
  const t = useTranslations("admin");
  const [etatR, actionR, enCoursR] = useActionState<EtatAction, FormData>(regler.bind(null, marche), {});
  const [etatA, actionA, enCoursA] = useActionState<EtatAction, FormData>(annuler.bind(null, marche), {});
  const [annulation, setAnnulation] = useState(false);

  if (etatR.succes || etatA.succes) return <MessageEtat etat={etatR.succes ? etatR : etatA} />;

  return (
    <div className="flex flex-col gap-3">
      <form
        action={actionR}
        onSubmit={(e) => {
          if (!window.confirm(t("confirmerReglement"))) e.preventDefault();
        }}
        className="flex flex-col gap-2.5"
      >
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1.5 text-sm font-bold">{t("bonneReponse")}</legend>
          {options.map((o) => (
            <label
              key={o.id}
              className={`flex h-11 cursor-pointer items-center gap-2 rounded-bouton border-2 border-foret px-4 font-bold has-[:checked]:ring-4 has-[:checked]:ring-foret/30 ${
                o.libelle === "OUI" ? "bg-vert-jaune text-foret" : "bg-brique text-white"
              }`}
            >
              <input type="radio" name="option" value={o.id} required className="size-4 accent-foret" />
              {o.libelle}
            </label>
          ))}
        </fieldset>
        <label className="text-sm font-bold">
          {t("lienSource")}
          <input type="url" name="lien" required placeholder="https://…" className={`${champ} mt-1`} />
        </label>
        <MessageEtat etat={etatR} />
        <div className="flex flex-wrap gap-2.5">
          <button type="submit" disabled={enCoursR} className="h-[46px] rounded-bouton border-2 border-foret bg-foret px-5 font-bold text-white dark:border-vert-jaune">
            {enCoursR ? "…" : t("reglerVerser")}
          </button>
          <button
            type="button"
            aria-expanded={annulation}
            onClick={() => setAnnulation(!annulation)}
            className="h-[46px] rounded-bouton border-2 border-contour bg-surface px-5 font-bold text-texte"
          >
            {t("annulerMarche")}
          </button>
        </div>
      </form>

      {annulation && (
        <form
          action={actionA}
          onSubmit={(e) => {
            if (!window.confirm(t("confirmerAnnulation"))) e.preventDefault();
          }}
          className="flex flex-col gap-2 rounded-bouton bg-doux p-3"
        >
          <label className="text-sm font-bold">
            {t("motifAnnulation")}
            <input name="motif" required minLength={3} maxLength={300} className={`${champ} mt-1`} />
          </label>
          <MessageEtat etat={etatA} />
          <button type="submit" disabled={enCoursA} className="h-11 self-start rounded-bouton border-2 border-foret bg-brique px-5 font-bold text-white">
            {t("confirmerAnnulerRembourser")}
          </button>
        </form>
      )}
    </div>
  );
}
