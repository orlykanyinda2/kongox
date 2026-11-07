"use server";

import { appeler, erreur, rafraichir, type EtatAction } from "@/lib/admin/rpc";

// Admin › Partenaires : suivi des demandes reçues par la page /partenaires
export async function changerStatutDemande(demande: number, statut: "nouvelle" | "en_cours" | "traitee" | "archivee"): Promise<EtatAction> {
  const { error } = await appeler("traiter_demande_partenaire", { p_demande: demande, p_statut: statut, p_note: null });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: "Statut changé." };
}

export async function noterDemande(demande: number, statut: string, donnees: FormData): Promise<EtatAction> {
  const { error } = await appeler("traiter_demande_partenaire", { p_demande: demande, p_statut: statut, p_note: String(donnees.get("note") ?? "") });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: "Note enregistrée." };
}
