"use server";

import { randomInt } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { estCategorie } from "@/lib/marches/categories";
import { nomValide } from "@/lib/compte/nomUtilisateur";

export type EtatAction = { erreur?: string; succes?: string };
export type EtatMotDePasse = EtatAction & { nom?: string; motDePasse?: string };

// Traduit le « hint » renvoyé par les fonctions SQL
async function erreur(hint: string | undefined | null, detail?: string): Promise<EtatAction> {
  const t = await getTranslations("erreursAdmin");
  const connus = [
    "reserve_admin", "statut_invalide", "decision_en_attente", "question_invalide", "categorie_invalide", "date_invalide",
    "source_invalide", "lien_obligatoire", "option_invalide", "soi_meme", "utilisateur_introuvable", "numero_manquant",
    "motivation_invalide", "deja_curateur", "candidature_en_attente", "connexion_requise",
  ];
  if (hint && connus.includes(hint)) return { erreur: t(hint) };
  if (detail) console.error("[admin]", detail);
  return { erreur: t("serveur") };
}

async function appeler(fonction: string, params: Record<string, unknown>) {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc(fonction, params);
  return { data, error };
}

function rafraichir(marches = false) {
  if (marches) updateTag("marches");
  refresh();
}

// ---------------------------------------------------------------------
// File d'approbation (admins et curateurs)
// ---------------------------------------------------------------------
export async function approuver(marche: number): Promise<EtatAction> {
  const t = await getTranslations("admin");
  const { data, error } = await appeler("approuver_marche", { p_marche: marche });
  if (error) return erreur(error.hint, error.message);
  rafraichir(true);
  return { succes: data === "en_validation" ? t("envoyeeValidation") : t("approuvee") };
}

export async function refuser(marche: number, _etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const t = await getTranslations("admin");
  const motif = String(donnees.get("motif") ?? "").trim();
  if (motif.length < 3) return { erreur: t("motifObligatoire") };
  const { data, error } = await appeler("refuser_marche", { p_marche: marche, p_motif: motif });
  if (error) return erreur(error.hint, error.message);
  rafraichir(true);
  return { succes: data === "en_validation" ? t("envoyeeValidation") : t("refusee") };
}

export async function modifier(marche: number, _etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const t = await getTranslations("admin");
  const categorie = String(donnees.get("categorie") ?? "");
  const date = String(donnees.get("date_fin") ?? "");
  const heure = String(donnees.get("heure_fin") ?? "") || "20:00";
  if (!estCategorie(categorie)) return erreur("categorie_invalide");
  const dateFin = new Date(`${date}T${heure}:00+01:00`); // heure de Kinshasa
  if (Number.isNaN(dateFin.getTime())) return erreur("date_invalide");
  const { error } = await appeler("modifier_marche", {
    p_marche: marche,
    p_question: String(donnees.get("question") ?? ""),
    p_categorie: categorie,
    p_date_fin: dateFin.toISOString(),
    p_source: String(donnees.get("source") ?? ""),
  });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: t("modifiee") };
}

export async function validerDecision(decision: number, accepter: boolean): Promise<EtatAction> {
  const t = await getTranslations("admin");
  const { error } = await appeler("valider_decision_curateur", { p_decision: decision, p_accepter: accepter });
  if (error) return erreur(error.hint, error.message);
  rafraichir(true);
  return { succes: accepter ? t("decisionValidee") : t("decisionRejetee") };
}

export async function definirSoki(marche: number): Promise<EtatAction> {
  const t = await getTranslations("admin");
  const { error } = await appeler("definir_soki_du_jour", { p_marche: marche });
  if (error) return erreur(error.hint, error.message);
  rafraichir(true);
  return { succes: t("sokiDefini") };
}

// ---------------------------------------------------------------------
// Résultats : régler ou annuler
// ---------------------------------------------------------------------
export async function regler(marche: number, _etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const t = await getTranslations("admin");
  const option = Number(donnees.get("option"));
  const lien = String(donnees.get("lien") ?? "").trim();
  if (!Number.isInteger(option) || option <= 0) return { erreur: t("choisirResultat") };
  if (!/^https?:\/\/\S+\.\S+/.test(lien)) return erreur("lien_obligatoire");
  const { data, error } = await appeler("regler_marche", { p_marche: marche, p_option_gagnante: option, p_lien_resultat: lien });
  if (error) return erreur(error.hint, error.message);
  const r = data as { cagnotte: number; gagnants: number; rembourse: boolean };
  rafraichir(true);
  updateTag(`marche-${marche}`);
  return { succes: r.rembourse ? t("regleRembourse") : t("regleOk", { gagnants: r.gagnants, cagnotte: r.cagnotte }) };
}

export async function annuler(marche: number, _etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const t = await getTranslations("admin");
  const motif = String(donnees.get("motif") ?? "").trim();
  if (motif.length < 3) return { erreur: t("motifObligatoire") };
  const { error } = await appeler("annuler_marche", { p_marche: marche, p_motif: motif });
  if (error) return erreur(error.hint, error.message);
  rafraichir(true);
  updateTag(`marche-${marche}`);
  return { succes: t("annuleOk") };
}

// ---------------------------------------------------------------------
// Mots de passe (clé service role, côté serveur uniquement)
// ---------------------------------------------------------------------
const MOTS = ["Mbote", "Kitoko", "Elonga", "Malamu", "Sango", "Lobi", "Moto", "Bilanga", "Mwinda", "Nzela"];

function motDePasseTemporaire() {
  return `${MOTS[randomInt(MOTS.length)]}-${randomInt(1000, 10000)}-${MOTS[randomInt(MOTS.length)]}`;
}

// Échappe _ et % pour une recherche ILIKE exacte (sans tenir compte des majuscules)
function motifExact(nom: string) {
  return nom.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function idParNom(nom: string): Promise<{ id: string; nom_utilisateur: string; role: string } | null> {
  const supabase = await creerClientServeur();
  const { data } = await supabase.from("utilisateurs").select("id, nom_utilisateur, role").ilike("nom_utilisateur", motifExact(nom)).limit(5);
  return data?.find((u) => u.nom_utilisateur.toLowerCase() === nom.toLowerCase()) ?? null;
}

async function verifierAdmin() {
  const supabase = await creerClientServeur();
  const { data } = await supabase.rpc("est_admin");
  return data === true;
}

export async function reinitialiserMotDePasse(_etat: EtatMotDePasse, donnees: FormData): Promise<EtatMotDePasse> {
  const t = await getTranslations("admin");
  const nom = String(donnees.get("nom") ?? "").trim().replace(/^@/, "");
  if (!(await verifierAdmin())) return erreur("reserve_admin");
  if (!nomValide(nom)) return erreur("utilisateur_introuvable");
  const cible = await idParNom(nom);
  if (!cible) return erreur("utilisateur_introuvable");

  const motDePasse = motDePasseTemporaire();
  const { error } = await creerClientAdmin().auth.admin.updateUserById(cible.id, { password: motDePasse });
  if (error) return erreur(null, error.message);

  const supabase = await creerClientServeur();
  await supabase.rpc("journaliser_action_admin", { p_action: "mot_de_passe_reinitialise", p_utilisateur: cible.id });
  return { succes: t("motDePasseOk"), nom: cible.nom_utilisateur, motDePasse };
}

// ---------------------------------------------------------------------
// Utilisateurs : rôle et suspension
// ---------------------------------------------------------------------
export async function changerRole(utilisateur: string, _etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const t = await getTranslations("admin");
  const { error } = await appeler("changer_role", { p_utilisateur: utilisateur, p_role: String(donnees.get("role") ?? "") });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: t("roleChange") };
}

export async function suspendre(utilisateur: string, suspendu: boolean): Promise<EtatAction> {
  const t = await getTranslations("admin");
  if (!(await verifierAdmin())) return erreur("reserve_admin");
  const supabase = await creerClientServeur();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub === utilisateur) return erreur("soi_meme");

  // 100 ans de suspension = jusqu'à réactivation ; « none » lève la suspension
  const { error } = await creerClientAdmin().auth.admin.updateUserById(utilisateur, { ban_duration: suspendu ? "876000h" : "none" });
  if (error) return erreur(null, error.message);
  await supabase.rpc("journaliser_action_admin", { p_action: suspendu ? "compte_suspendu" : "compte_reactive", p_utilisateur: utilisateur });
  rafraichir();
  return { succes: suspendu ? t("suspendu") : t("reactive") };
}

// ---------------------------------------------------------------------
// Curateurs
// ---------------------------------------------------------------------
export async function traiterCandidature(candidature: number, accepter: boolean): Promise<EtatAction> {
  const t = await getTranslations("admin");
  const { error } = await appeler("traiter_candidature", { p_candidature: candidature, p_accepter: accepter, p_motif: null });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: accepter ? t("candidatureAcceptee") : t("candidatureRefusee") };
}

export async function changerStatutCurateur(utilisateur: string, categorie: string, statut: "essai" | "autonome" | "retirer"): Promise<EtatAction> {
  const t = await getTranslations("admin");
  const { error } = await appeler("changer_statut_curateur", { p_utilisateur: utilisateur, p_categorie: categorie, p_statut: statut });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: t("curateurModifie") };
}

// ---------------------------------------------------------------------
// Cadeaux
// ---------------------------------------------------------------------
export async function creerCadeau(_etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const t = await getTranslations("admin");
  const { error } = await appeler("creer_cadeau", {
    p_nom_utilisateur: String(donnees.get("nom") ?? "").trim().replace(/^@/, ""),
    p_type: String(donnees.get("type") ?? ""),
    p_description: String(donnees.get("description") ?? "").trim(),
  });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: t("cadeauCree") };
}

export async function marquerCadeauEnvoye(cadeau: number): Promise<EtatAction> {
  const t = await getTranslations("admin");
  const { error } = await appeler("marquer_cadeau_envoye", { p_cadeau: cadeau });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: t("cadeauEnvoye") };
}

export async function annulerCadeau(cadeau: number): Promise<EtatAction> {
  const t = await getTranslations("admin");
  const { error } = await appeler("annuler_cadeau", { p_cadeau: cadeau });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: t("cadeauAnnule") };
}

// ---------------------------------------------------------------------
// Candidature curateur (utilisateur connecté)
// ---------------------------------------------------------------------
export async function postulerCurateur(_etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const t = await getTranslations("curateur");
  const categorie = String(donnees.get("categorie") ?? "");
  if (!estCategorie(categorie)) return erreur("categorie_invalide");
  const { error } = await appeler("postuler_curateur", { p_categorie: categorie, p_motivation: String(donnees.get("motivation") ?? "") });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: t("envoyee") };
}
