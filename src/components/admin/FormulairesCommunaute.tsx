"use client";

import { useActionState } from "react";
import { creerCommunaute, creerDuel } from "@/app/actions/backoffice";
import type { EtatAction } from "@/app/actions/admin";
import { cls } from "./ui";

function Message({ etat }: { etat: EtatAction }) {
  if (!etat.erreur && !etat.succes) return null;
  return <span className={`text-[13px] font-medium ${etat.erreur ? "text-adm-danger" : "text-adm-accent"}`}>{etat.erreur ?? etat.succes}</span>;
}

export function FormulaireCommunaute() {
  const [etat, action, enCours] = useActionState<EtatAction, FormData>(creerCommunaute, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <label className={cls.label}>
        Nom
        <input name="nom" required minLength={2} maxLength={60} placeholder="Ex. : Kinshasa, UNIKIN, Fans V.Club" className={`${cls.champ} mt-1`} />
      </label>
      <label className={cls.label}>
        Type
        <select name="type" className={`${cls.champ} mt-1`}>
          <option value="ville">Ville</option>
          <option value="universite">Université</option>
          <option value="fan_club">Fan-club</option>
          <option value="autre">Autre</option>
        </select>
      </label>
      <label className={cls.label}>
        Description (facultative)
        <input name="description" maxLength={200} className={`${cls.champ} mt-1`} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={enCours} className={cls.principal}>
          Créer la communauté
        </button>
        <Message etat={etat} />
      </div>
    </form>
  );
}

export function FormulaireDuel({ communautes }: { communautes: { id: number; nom: string }[] }) {
  const [etat, action, enCours] = useActionState<EtatAction, FormData>(creerDuel, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <label className={cls.label}>
        Titre
        <input name="titre" required minLength={2} maxLength={40} placeholder="Ex. : Villes" className={`${cls.champ} mt-1`} />
      </label>
      <label className={cls.label}>
        Communauté A
        <select name="a" required className={`${cls.champ} mt-1`}>
          {communautes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </label>
      <label className={cls.label}>
        Communauté B
        <select name="b" required defaultValue={communautes[1]?.id} className={`${cls.champ} mt-1`}>
          {communautes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={enCours || communautes.length < 2} className={cls.principal}>
          Créer le duel
        </button>
        <Message etat={etat} />
      </div>
    </form>
  );
}
