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
    votes: lignes.map((v) => ({
      id: Number(v.id),
      nom: v.nom,
      invite: v.invite,
      icone: v.icone,
      photo: v.photo,
      elite: v.elite,
      choix: v.choix,
      ordre: Number(v.ordre),
      montant: Number(v.montant),
      cree_le: v.cree_le,
    })),
    total: lignes.length ? Number(lignes[0].total) : 0,
  };
}
