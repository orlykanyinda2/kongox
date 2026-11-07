"use server";

import { refresh } from "next/cache";
import { creerClientServeur } from "@/lib/supabase/serveur";

export type EtatSocial = { erreur?: string; actif?: boolean };

const MESSAGES: Record<string, string> = {
  connexion_requise: "Connecte-toi d'abord.",
  utilisateur_introuvable: "Ce pronostiqueur n'existe pas.",
  soi_meme: "Tu ne peux pas te suivre toi-même.",
  trop_de_communautes: "Trois communautés au maximum : quittes-en une d'abord.",
  statut_invalide: "Cette communauté n'est plus disponible.",
};

function message(hint?: string | null) {
  return MESSAGES[hint ?? ""] ?? "Un problème est survenu. Réessaie dans un instant.";
}

// Suivre ou ne plus suivre un pronostiqueur
export async function suivre(nom: string, valeur: boolean): Promise<EtatSocial> {
  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("suivre", { p_nom: nom, p_suivre: valeur });
  if (error) return { erreur: message(error.hint) };
  refresh();
  return { actif: valeur };
}

// Rejoindre ou quitter une communauté (3 au maximum)
export async function rejoindreCommunaute(communaute: number, valeur: boolean): Promise<EtatSocial> {
  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("rejoindre_communaute", { p_communaute: communaute, p_rejoindre: valeur });
  if (error) return { erreur: message(error.hint) };
  refresh();
  return { actif: valeur };
}
