"use client";

import Form from "next/form";
import Link from "next/link";
import { useRef } from "react";

type Option = { valeur: string; libelle: string };
type Props = {
  valeurs: { q: string; categorie: string; statut: string; communaute: string; tri: string };
  categories: Option[];
  statuts: Option[];
  tris: Option[];
  communautes: Option[];
  libelles: { rechercher: string; exemple: string; categorie: string; toutes: string; statut: string; communaute: string; tri: string; appliquer: string; effacer: string };
};

const CHAMP = "h-11 w-full rounded-bouton border border-separateur bg-surface px-3 text-[15px] text-texte outline-none focus-visible:ring-4 focus-visible:ring-vert-jaune/60";

// Filtres de /marches. Tout passe par l'URL (?q=…&categorie=…&tri=…) : lien partageable,
// et le formulaire marche aussi sans JavaScript (bouton « Appliquer »).
export function FiltresMarches({ valeurs, categories, statuts, tris, communautes, libelles }: Props) {
  const formulaire = useRef<HTMLFormElement>(null);
  const soumettre = () => formulaire.current?.requestSubmit();
  const actifs = valeurs.q || valeurs.categorie || valeurs.communaute || valeurs.statut !== "en_ligne" || valeurs.tri !== "tendance";

  return (
    <Form ref={formulaire} action="/marches" className="mt-5 flex flex-col gap-3" role="search">
      <div className="flex gap-2">
        <label htmlFor="q-marches" className="sr-only">
          {libelles.rechercher}
        </label>
        <input id="q-marches" name="q" type="search" defaultValue={valeurs.q} placeholder={libelles.exemple} maxLength={80} className={`${CHAMP} bg-doux px-4`} />
        <button type="submit" className="h-11 flex-none rounded-bouton bg-foret px-4 text-[15px] font-bold text-white dark:bg-vert-jaune dark:text-foret">
          {libelles.rechercher}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-texte-secondaire">
          {libelles.categorie}
          <select name="categorie" defaultValue={valeurs.categorie} onChange={soumettre} className={CHAMP}>
            <option value="">{libelles.toutes}</option>
            {categories.map((o) => (
              <option key={o.valeur} value={o.valeur}>
                {o.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-texte-secondaire">
          {libelles.statut}
          <select name="statut" defaultValue={valeurs.statut} onChange={soumettre} className={CHAMP}>
            {statuts.map((o) => (
              <option key={o.valeur} value={o.valeur}>
                {o.libelle}
              </option>
            ))}
          </select>
        </label>
        {communautes.length > 0 && (
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-texte-secondaire">
            {libelles.communaute}
            <select name="communaute" defaultValue={valeurs.communaute} onChange={soumettre} className={CHAMP}>
              <option value="">{libelles.toutes}</option>
              {communautes.map((o) => (
                <option key={o.valeur} value={o.valeur}>
                  {o.libelle}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-texte-secondaire">
          {libelles.tri}
          <select name="tri" defaultValue={valeurs.tri} onChange={soumettre} className={CHAMP}>
            {tris.map((o) => (
              <option key={o.valeur} value={o.valeur}>
                {o.libelle}
              </option>
            ))}
          </select>
        </label>
      </div>

      <noscript>
        <button type="submit" className="h-11 rounded-bouton border border-separateur px-4 font-bold">
          {libelles.appliquer}
        </button>
      </noscript>
      {actifs && (
        <Link href="/marches" className="self-start text-sm font-bold text-hunter underline dark:text-vert-jaune">
          {libelles.effacer}
        </Link>
      )}
    </Form>
  );
}
