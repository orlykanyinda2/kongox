"use server";

import { refresh, updateTag } from "next/cache";
import { creerClientServeur } from "@/lib/supabase/serveur";

// Icône de profil : choisir, acheter (pièces gratuites, via mouvement_pieces), retirer sa photo.
export type EtatIcone = { erreur?: string; succes?: string };

const MESSAGES: Record<string, string> = {
  connexion_requise: "Connecte-toi d'abord.",
  reserve_comptes: "Crée ton compte pour acheter des icônes ou mettre ta photo.",
  icone_indisponible: "Cette icône n'est pas disponible pour toi.",
  deja_possedee: "Tu as déjà cette icône.",
  solde_insuffisant: "Tu n'as pas assez de pièces pour cette icône.",
  photo_invalide: "La photo n'a pas pu être enregistrée. Réessaie.",
};

function message(hint?: string | null) {
  return MESSAGES[hint ?? ""] ?? "Un problème est survenu. Réessaie dans un instant.";
}

function rafraichir() {
  updateTag("marches"); // les cartes et salons affichent l'icône
  updateTag("profils");
  refresh();
}

export async function choisirIcone(code: string): Promise<EtatIcone> {
  const { error } = await (await creerClientServeur()).rpc("choisir_icone", { p_code: code });
  if (error) return { erreur: message(error.hint) };
  rafraichir();
  return { succes: "Icône changée." };
}

export async function acheterIcone(code: string): Promise<EtatIcone> {
  const { error } = await (await creerClientServeur()).rpc("acheter_icone", { p_code: code });
  if (error) return { erreur: message(error.hint) };
  rafraichir();
  return { succes: "Icône achetée : c'est ta nouvelle icône !" };
}

// Après l'envoi de la photo par le navigateur dans le stockage (dossier de la personne)
export async function enregistrerPhoto(chemin: string): Promise<EtatIcone> {
  const { error } = await (await creerClientServeur()).rpc("definir_photo", { p_chemin: chemin });
  if (error) return { erreur: message(error.hint) };
  rafraichir();
  return { succes: "Photo enregistrée." };
}

export async function retirerMaPhoto(): Promise<EtatIcone> {
  const supabase = await creerClientServeur();
  const { data: session } = await supabase.auth.getClaims();
  const id = session?.claims?.sub;
  if (!id) return { erreur: message("connexion_requise") };
  const { data: u } = await supabase.from("utilisateurs").select("photo").eq("id", id).maybeSingle<{ photo: string | null }>();
  const { error } = await supabase.rpc("retirer_ma_photo");
  if (error) return { erreur: message(error.hint) };
  if (u?.photo) await supabase.storage.from("avatars").remove([u.photo]);
  rafraichir();
  return { succes: "Photo retirée : ton icône revient." };
}
