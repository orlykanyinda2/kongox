"use client";

import { useRef, useState, useTransition } from "react";
import type { EtatAction } from "@/app/actions/admin";
import { cls } from "./ui";

type Variante = "principal" | "secondaire" | "danger" | "dangerContour";

function Message({ etat }: { etat: EtatAction }) {
  if (!etat.erreur && !etat.succes) return null;
  return (
    <span role={etat.erreur ? "alert" : "status"} className={`text-xs font-medium ${etat.erreur ? "text-adm-danger" : "text-adm-accent"}`}>
      {etat.erreur ?? etat.succes}
    </span>
  );
}

// Bouton simple (sans risque) qui appelle une Server Action
export function BoutonAction({ action, libelle, variante = "secondaire" }: { action: () => Promise<EtatAction>; libelle: string; variante?: Variante }) {
  const [enCours, demarrer] = useTransition();
  const [etat, setEtat] = useState<EtatAction>({});
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" disabled={enCours} onClick={() => demarrer(async () => setEtat(await action()))} className={cls[variante]}>
        {enCours ? "…" : libelle}
      </button>
      <Message etat={etat} />
    </span>
  );
}

type ChampConfirmation = { nom: string; libelle: string; requis?: boolean; type?: "texte" | "zone" };

type PropsConfirmation = {
  action: (donnees: FormData) => Promise<EtatAction>;
  libelle: string;
  titre: string;
  message: string; // conséquences, ex. « 34 mises seront remboursées »
  confirmer: string;
  variante?: Variante;
  danger?: boolean;
  champs?: ChampConfirmation[];
};

// Action avec fenêtre de confirmation obligatoire (et éventuellement un motif à saisir)
export function ActionConfirmee({ action, libelle, titre, message, confirmer, variante = "dangerContour", danger = true, champs = [] }: PropsConfirmation) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const [enCours, demarrer] = useTransition();
  const [etat, setEtat] = useState<EtatAction>({});

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={() => dialogue.current?.showModal()} className={cls[variante]}>
        {libelle}
      </button>
      <Message etat={etat} />
      <dialog
        ref={dialogue}
        className="m-auto w-[min(440px,calc(100vw-32px))] rounded-lg border border-adm-bordure bg-white p-0 text-adm-texte backdrop:bg-black/40"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const donnees = new FormData(e.currentTarget);
            demarrer(async () => {
              const r = await action(donnees);
              setEtat(r);
              if (!r.erreur) dialogue.current?.close();
            });
          }}
          className="flex flex-col gap-3 p-5"
        >
          <h2 className="font-sans text-base font-semibold tracking-normal">{titre}</h2>
          <p className="text-sm leading-relaxed">{message}</p>
          {champs.map((c) => (
            <label key={c.nom} className={cls.label}>
              {c.libelle}
              {c.type === "zone" ? (
                <textarea name={c.nom} required={c.requis} rows={3} className={`${cls.zoneTexte} mt-1`} />
              ) : (
                <input name={c.nom} required={c.requis} minLength={c.requis ? 3 : undefined} className={`${cls.champ} mt-1`} />
              )}
            </label>
          ))}
          {etat.erreur && <Message etat={etat} />}
          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={() => dialogue.current?.close()} className={cls.secondaire}>
              Annuler
            </button>
            <button type="submit" disabled={enCours} className={danger ? cls.danger : cls.principal}>
              {enCours ? "…" : confirmer}
            </button>
          </div>
        </form>
      </dialog>
    </span>
  );
}
