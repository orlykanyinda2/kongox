"use server";

import { refresh, updateTag } from "next/cache";
import { creerClientServeur } from "@/lib/supabase/serveur";

// « Nouveau badge ! » montré : on ne le montre plus
export async function marquerBadgesVus(): Promise<void> {
  await (await creerClientServeur()).rpc("marquer_badges_vus");
}

// Les 4 badges mis en avant sur le profil public
export async function choisirBadgesVedette(codes: string[]): Promise<{ erreur?: string; succes?: string }> {
  const { error } = await (await creerClientServeur()).rpc("choisir_badges_vedette", { p_codes: codes.slice(0, 4) });
  if (error) return { erreur: error.hint === "hors_limites" ? "Quatre badges au maximum." : "Un problème est survenu. Réessaie." };
  updateTag("profils");
  refresh();
  return { succes: "Badges mis en avant enregistrés." };
}
