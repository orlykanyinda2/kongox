import "server-only";
import { connection } from "next/server";
import { creerClientPublic } from "@/lib/supabase/public";

// « Qui a voté » : les prédictions d'un marché, publiques (icône, pseudo, choix, mise, heure)
export type Vote = {
  id: number;
  nom: string | null; // null = invité fermé (affiché « invité »)
  invite: boolean;
  icone: string | null;
  photo: string | null;
  elite: boolean;
  choix: string;
  ordre: number;
  montant: number;
  cree_le: string;
};
export type TriVotes = "recents" | "mises";
export const VOTES_PAR_PAGE = 20;

export async function votesMarche(marche: number, ordre: number | null, tri: TriVotes, decalage: number): Promise<{ votes: Vote[]; total: number }> {
  await connection();
  const { data, error } = await creerClientPublic().rpc("votes_marche", {
    p_marche: marche,
    p_ordre: ordre,
    p_tri: tri,
    p_decalage: decalage,
    p_limite: VOTES_PAR_PAGE,
  });
  if (error) {
    console.error("[votes] liste :", error.message);
    return { votes: [], total: 0 };
  }
  const lignes = (data ?? []) as (Vote & { total: number })[];
  return {
    votes: lignes.map(({ total: _t, ...v }) => ({ ...v, id: Number(v.id), montant: Number(v.montant), ordre: Number(v.ordre) })),
    total: lignes.length ? Number(lignes[0].total) : 0,
  };
}
