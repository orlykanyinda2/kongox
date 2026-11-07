"use server";

import { updateTag } from "next/cache";
import { appeler, erreur, rafraichir, verifierAdmin, type EtatAction } from "@/lib/admin/rpc";
import { creerClientAdmin } from "@/lib/supabase/admin";

// Admin › Badges et icônes, et retrait des photos signalées. Chaque fonction SQL vérifie l'admin et écrit au journal.

export async function enregistrerBadge(_etat: EtatAction, d: FormData): Promise<EtatAction> {
  const { error } = await appeler("enregistrer_badge", {
    p_code: String(d.get("code") ?? "").trim().toLowerCase(),
    p_nom: String(d.get("nom") ?? ""),
    p_description: String(d.get("description") ?? ""),
    p_glyphe: String(d.get("glyphe") ?? "etoile"),
    p_niveau: String(d.get("niveau") ?? "bronze"),
    p_famille: String(d.get("famille") ?? ""),
    p_condition: String(d.get("condition") ?? "manuel"),
    p_seuil: Number.parseInt(String(d.get("seuil") ?? "0"), 10) || 0,
    p_actif: d.get("actif") === "on",
  });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: "Badge enregistré." };
}

export async function offrirBadge(_etat: EtatAction, d: FormData): Promise<EtatAction> {
  const { error } = await appeler("offrir_badge", { p_nom_utilisateur: String(d.get("nom") ?? ""), p_code: String(d.get("code") ?? "") });
  if (error) return erreur(error.hint, error.message);
  updateTag("profils");
  rafraichir();
  return { succes: "Badge offert." };
}

export async function modifierIcone(code: string, _etat: EtatAction, d: FormData): Promise<EtatAction> {
  const { error } = await appeler("modifier_icone", {
    p_code: code,
    p_prix: Number.parseInt(String(d.get("prix") ?? "0").replace(/\s/g, ""), 10) || 0,
    p_actif: d.get("actif") === "on",
  });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: "Enregistré." };
}

export async function offrirIcone(_etat: EtatAction, d: FormData): Promise<EtatAction> {
  const porter = d.get("porter") === "on";
  const { error } = await appeler("offrir_icone", { p_nom_utilisateur: String(d.get("nom") ?? ""), p_code: String(d.get("code") ?? ""), p_porter: porter });
  if (error) return erreur(error.hint, error.message);
  updateTag("marches");
  updateTag("profils");
  rafraichir();
  return { succes: porter ? "Icône changée." : "Icône offerte." };
}

// Retire la photo d'une personne (fichier effacé du stockage) ; son icône revient
export async function retirerPhoto(utilisateur: string, d: FormData): Promise<EtatAction> {
  if (!(await verifierAdmin())) return erreur("reserve_admin");
  const { data: chemin, error } = await appeler("retirer_photo", { p_utilisateur: utilisateur, p_motif: String(d.get("motif") ?? "").trim() || "moderation" });
  if (error) return erreur(error.hint, error.message);
  if (typeof chemin === "string" && chemin) await creerClientAdmin().storage.from("avatars").remove([chemin]);
  updateTag("marches");
  updateTag("profils");
  rafraichir();
  return { succes: "Photo retirée." };
}
