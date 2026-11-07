"use server";

import { appeler, erreur, rafraichir, type EtatAction } from "@/lib/admin/rpc";

// Modération du chat (Admin › Signalements). Chaque fonction SQL vérifie que l'appelant est admin
// et écrit dans le journal.

export async function masquerMessage(message: number, donnees: FormData): Promise<EtatAction> {
  const motif = String(donnees.get("motif") ?? "").trim().slice(0, 200) || "moderation";
  const { error } = await appeler("masquer_message", { p_message: message, p_motif: motif });
  if (error) return erreur(error.hint, error.message);
  rafraichir(true);
  return { succes: "Message masqué." };
}

export async function retablirMessage(message: number): Promise<EtatAction> {
  const { error } = await appeler("retablir_message", { p_message: message });
  if (error) return erreur(error.hint, error.message);
  rafraichir(true);
  return { succes: "Message rétabli." };
}

export async function traiterSignalement(signalement: number, statut: "traite" | "rejete"): Promise<EtatAction> {
  const { error } = await appeler("traiter_signalement", { p_signalement: signalement, p_statut: statut });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: statut === "rejete" ? "Signalement rejeté." : "Signalement traité." };
}

export async function bloquerChat(utilisateur: string, heures: number): Promise<EtatAction> {
  const { error } = await appeler("bloquer_chat", { p_utilisateur: utilisateur, p_heures: heures });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: heures === 0 ? "Chat débloqué." : `Chat bloqué ${heures >= 24 ? `${heures / 24} j` : `${heures} h`}.` };
}

export async function ajouterMotInterdit(_etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const { error } = await appeler("ajouter_mot_interdit", { p_mot: String(donnees.get("mot") ?? "") });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: "Mot ajouté." };
}

export async function retirerMotInterdit(id: number): Promise<EtatAction> {
  const { error } = await appeler("retirer_mot_interdit", { p_id: id });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: "Mot retiré." };
}
