"use server";

import { lireFiltres, rechercherMarches, TAILLE_PAGE, type ResultatRecherche } from "@/lib/marches/fil";

// Page suivante de /marches (chargement progressif au défilement).
// Les filtres sont relus et vérifiés ici : on ne fait jamais confiance au navigateur.
export async function chargerMarches(parametres: Record<string, string>, decalage: number): Promise<ResultatRecherche> {
  const d = Number.isInteger(decalage) && decalage >= 0 && decalage <= 10_000 ? decalage : 0;
  const filtres = lireFiltres(parametres ?? {});
  const r = await rechercherMarches(filtres, Math.floor(d / TAILLE_PAGE) * TAILLE_PAGE);
  return r;
}
