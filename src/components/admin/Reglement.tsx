"use client";

import { useRef, useState, useTransition } from "react";
import { annuler, regler, type EtatAction } from "@/app/actions/admin";
import { formaterNombre } from "@/lib/format";
import { ActionConfirmee } from "./Actions";
import { cls } from "./ui";

type Option = { id: number; libelle: string; total_mise: number };

// Régler : bonne réponse + lien de la source, puis confirmation (les gains partent tout de suite).
export function Reglement({ marche, options }: { marche: number; options: Option[] }) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const formulaire = useRef<HTMLFormElement>(null);
  const [choix, setChoix] = useState<Option | null>(null);
  const [etat, setEtat] = useState<EtatAction>({});
  const [enCours, demarrer] = useTransition();
  const cagnotte = options.reduce((s, o) => s + o.total_mise, 0);

  if (etat.succes) return <p className="text-[13px] font-medium text-adm-accent">{etat.succes}</p>;

  return (
    <div className="flex flex-col gap-2">
      <form
        ref={formulaire}
        onSubmit={(e) => {
          e.preventDefault();
          if (!choix) return;
          dialogue.current?.showModal();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <fieldset className="flex gap-3">
          <legend className={cls.label}>Bonne réponse</legend>
          {options.map((o) => (
            <label key={o.id} className="mt-1 flex items-center gap-1.5 text-sm">
              <input type="radio" name="option" value={o.id} required onChange={() => setChoix(o)} className="accent-adm-accent" />
              {o.libelle}
            </label>
          ))}
        </fieldset>
        <label className={`${cls.label} min-w-[260px] flex-1`}>
          Lien de la source
          <input type="url" name="lien" required placeholder="https://…" className={`${cls.champ} mt-1`} />
        </label>
        <button type="submit" className={cls.principal}>
          Régler…
        </button>
        <ActionConfirmee
          action={annuler.bind(null, marche, {})}
          libelle="Annuler le marché"
          titre="Annuler ce marché ?"
          message={`Toutes les mises (${formaterNombre(cagnotte)} pièces) seront remboursées. Le marché sera affiché comme annulé.`}
          confirmer="Annuler et rembourser"
          champs={[{ nom: "motif", libelle: "Motif (visible sur la page du marché)", requis: true }]}
        />
      </form>
      {etat.erreur && <p className="text-[13px] font-medium text-adm-danger">{etat.erreur}</p>}

      <dialog ref={dialogue} className="m-auto w-[min(440px,calc(100vw-32px))] rounded-lg border border-adm-bordure bg-white p-5 text-adm-texte backdrop:bg-black/40">
        <h2 className="text-base font-semibold">Confirmer le résultat : {choix?.libelle}</h2>
        <p className="mt-2 text-sm leading-relaxed">
          La cagnotte de {formaterNombre(cagnotte)} pièces sera partagée entre ceux qui ont misé sur {choix?.libelle} (
          {formaterNombre(choix?.total_mise ?? 0)} pièces misées). C&apos;est définitif.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => dialogue.current?.close()} className={cls.secondaire}>
            Annuler
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const r = await regler(marche, {}, new FormData(formulaire.current!));
                setEtat(r);
                dialogue.current?.close();
              })
            }
            className={cls.principal}
          >
            {enCours ? "…" : "Régler et verser les gains"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
