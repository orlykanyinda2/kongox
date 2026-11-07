"use client";

import { useActionState, useState } from "react";
import { creerModele } from "@/app/actions/backoffice";
import type { EtatAction } from "@/app/actions/admin";
import { CATEGORIES, LIBELLES_CATEGORIES } from "@/lib/marches/categories";
import { cls } from "./ui";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// Nouveau modèle de marché récurrent (chaque jour ou chaque semaine)
export function FormulaireModele() {
  const [etat, action, enCours] = useActionState<EtatAction, FormData>(creerModele, {});
  const [frequence, setFrequence] = useState("quotidienne");
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <label className={`${cls.label} md:col-span-2`}>
        Question (modèle)
        <input name="question" required minLength={15} maxLength={200} placeholder="Ex. : Y aura-t-il plus de 3 coupures de courant à Limete le {date} ?" className={`${cls.champ} mt-1`} />
        <span className={cls.aide}>« {"{date}"} » est remplacé par la date de publication (12/12/2026).</span>
      </label>
      <label className={cls.label}>
        Catégorie
        <select name="categorie" className={`${cls.champ} mt-1`}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {LIBELLES_CATEGORIES[c]}
            </option>
          ))}
        </select>
      </label>
      <label className={cls.label}>
        Source
        <input name="source" required minLength={3} maxLength={200} className={`${cls.champ} mt-1`} />
      </label>
      <label className={cls.label}>
        Fréquence
        <select name="frequence" value={frequence} onChange={(e) => setFrequence(e.target.value)} className={`${cls.champ} mt-1`}>
          <option value="quotidienne">Chaque jour</option>
          <option value="hebdomadaire">Chaque semaine</option>
        </select>
      </label>
      {frequence === "hebdomadaire" ? (
        <label className={cls.label}>
          Jour
          <select name="jour_semaine" className={`${cls.champ} mt-1`}>
            {JOURS.map((j, i) => (
              <option key={j} value={i + 1}>
                {j}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span />
      )}
      <label className={cls.label}>
        Heure de publication (Kinshasa)
        <input type="time" name="heure" defaultValue="08:00" required className={`${cls.champ} mt-1`} />
      </label>
      <label className={cls.label}>
        Ouvert pendant (heures)
        <input type="number" name="duree_heures" defaultValue={24} min={1} max={8760} required className={`${cls.champ} mt-1`} />
      </label>
      <label className="flex items-center gap-1.5 text-sm md:col-span-2">
        <input type="checkbox" name="soki" className="accent-adm-accent" />
        Devient le « Soki du jour » à chaque publication
      </label>
      {(etat.erreur || etat.succes) && (
        <p role={etat.erreur ? "alert" : "status"} className={`text-[13px] font-medium md:col-span-2 ${etat.erreur ? "text-adm-danger" : "text-adm-accent"}`}>
          {etat.erreur ?? etat.succes}
        </p>
      )}
      <div className="md:col-span-2">
        <button type="submit" disabled={enCours} className={cls.principal}>
          {enCours ? "…" : "Créer le modèle"}
        </button>
      </div>
    </form>
  );
}
