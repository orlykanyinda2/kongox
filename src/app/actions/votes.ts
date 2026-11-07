"use server";

import { votesMarche, type TriVotes } from "@/lib/votes/donnees";
import { creerClientServeur } from "@/lib/supabase/serveur";

// Page suivante, filtre ou tri de « Qui a voté » (valeurs revérifiées ici)
export async function chargerVotes(marche: number, ordre: number | null, tri: string, decalage: number) {
  const m = Number.isInteger(marche) && marche > 0 ? marche : 0;
  const o = ordre === null || [0, 1, 2].includes(ordre) ? ordre : null;
  const tr: TriVotes = tri === "mises" ? "mises" : "recents";
  const d = Number.isInteger(decalage) && decalage >= 0 && decalage <= 100_000 ? decalage : 0;
  return votesMarche(m, o, tr, d);
}

// « 12 personnes que tu suis ont voté » : pour les cartes affichées (100 au maximum)
export async function suivisAyantVote(marches: number[]): Promise<Record<number, number>> {
  const ids = [...new Set(marches.filter((x) => Number.isInteger(x) && x > 0))].slice(0, 100);
  if (ids.length === 0) return {};
  const supabase = await creerClientServeur();
  const { data: session } = await supabase.auth.getClaims();
  if (!session?.claims?.sub) return {};
  const { data, error } = await supabase.rpc("suivis_ayant_vote", { p_marches: ids });
  if (error) return {};
  return Object.fromEntries(((data ?? []) as { marche_id: number; nombre: number }[]).map((l) => [Number(l.marche_id), Number(l.nombre)]));
}
