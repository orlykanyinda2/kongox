import "server-only";
import { connection } from "next/server";
import { creerClientPublic } from "@/lib/supabase/public";

// Messages d'un salon : celui d'un marché (aussi celui d'un match) ou celui d'une communauté.
// Pas de cache : le salon bouge tout le temps ; la suite arrive en direct (Supabase Realtime).

export type MessageChat = {
  id: number;
  marche_id: number | null;
  communaute_id: number | null;
  auteur_nom: string;
  choix: string | null;
  texte: string | null;
  masque: boolean;
  cree_le: string;
};

export type CibleSalon = { marche: number } | { communaute: number };

export const CHAMPS_MESSAGE = "id, marche_id, communaute_id, auteur_nom, choix, texte, masque, cree_le";
export const MESSAGES_PAR_PAGE = 30;

export async function messagesSalon(cible: CibleSalon): Promise<{ messages: MessageChat[]; total: number }> {
  await connection();
  const db = creerClientPublic();
  const colonne = "marche" in cible ? "marche_id" : "communaute_id";
  const valeur = "marche" in cible ? cible.marche : cible.communaute;
  const [liste, compte] = await Promise.all([
    db.from("messages_chat").select(CHAMPS_MESSAGE).eq(colonne, valeur).order("id", { ascending: false }).limit(MESSAGES_PAR_PAGE),
    db.from("messages_chat").select("id", { count: "exact", head: true }).eq(colonne, valeur).eq("masque", false),
  ]);
  if (liste.error) console.error("[chat] messages :", liste.error.message);
  return { messages: (liste.data ?? []) as MessageChat[], total: compte.count ?? 0 };
}
