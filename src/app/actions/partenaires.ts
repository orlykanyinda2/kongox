"use server";

import { creerClientServeur } from "@/lib/supabase/serveur";

export type EtatDemande = { erreur?: string; succes?: boolean };


const MESSAGES: Record<string, string> = {
  demande_invalide: "Vérifie les champs : ton nom (2 caractères au moins) et un message de 10 caractères au moins.",
  contact_invalide: "Indique un numéro WhatsApp (ex. +243 81 234 5678) ou une adresse e-mail pour qu'on puisse te répondre.",
  demande_limite: "Beaucoup de demandes en ce moment. Réessaie plus tard ou écris-nous sur WhatsApp.",
};

// Demande de partenariat (page /partenaires). Visiteurs compris ; les limites anti-abus sont dans la fonction SQL.
export async function envoyerDemande(_etat: EtatDemande, donnees: FormData): Promise<EtatDemande> {
  // Champ caché : rempli seulement par les robots
  if (String(donnees.get("site_web") ?? "") !== "") return { succes: true };
  const champ = (nom: string, max: number) => String(donnees.get(nom) ?? "").trim().slice(0, max);
  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("envoyer_demande_partenaire", {
    p_nom: champ("nom", 80),
    p_organisation: champ("organisation", 120),
    p_type: champ("type", 20),
    p_contact: champ("contact", 120),
    p_message: champ("message", 2000),
  });
  if (error) {
    if (!MESSAGES[error.hint ?? ""]) console.error("[partenaires] demande :", error.message);
    return { erreur: MESSAGES[error.hint ?? ""] ?? "Un problème est survenu. Réessaie dans un instant ou écris-nous sur WhatsApp." };
  }
  return { succes: true };
}
