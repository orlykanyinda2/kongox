"use server";

import { updateTag } from "next/cache";
import { appeler, dateKinshasa, erreur, idParNom, rafraichir, verifierAdmin, type EtatAction } from "@/lib/admin/rpc";
import { creerClientAdmin } from "@/lib/supabase/admin";

// Back-office : marchés, programmation, pièces, réglages.
// Chaque fonction SQL vérifie elle-même que l'appelant est admin.

export type EtatCreation = EtatAction & { id?: number };

export async function creerMarcheAdmin(_etat: EtatCreation, donnees: FormData): Promise<EtatCreation> {
  const etat = String(donnees.get("etat") ?? "brouillon");
  const fin = dateKinshasa(donnees.get("fin_date"), donnees.get("fin_heure"));
  const publication = dateKinshasa(donnees.get("pub_date"), donnees.get("pub_heure"));
  if (!fin) return erreur("date_invalide");
  if (etat === "programme" && !publication) return erreur("date_publication_invalide");
  const { data, error } = await appeler("creer_marche_admin", {
    p_question: String(donnees.get("question") ?? ""),
    p_categorie: String(donnees.get("categorie") ?? ""),
    p_source: String(donnees.get("source") ?? ""),
    p_date_fin: fin,
    p_etat: etat,
    p_date_publication: publication,
    p_mis_en_avant: donnees.get("mis_en_avant") === "on",
    p_soki_programme: donnees.get("soki") === "on",
  });
  if (error) return erreur(error.hint, error.message);
  rafraichir(true);
  return { succes: "Marché créé.", id: data as number };
}

export async function modifierMarcheAdmin(marche: number, _etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const fin = dateKinshasa(donnees.get("fin_date"), donnees.get("fin_heure"));
  const publication = dateKinshasa(donnees.get("pub_date"), donnees.get("pub_heure"));
  if (!fin) return erreur("date_invalide");
  const { error } = await appeler("modifier_marche_admin", {
    p_marche: marche,
    p_question: String(donnees.get("question") ?? ""),
    p_categorie: String(donnees.get("categorie") ?? ""),
    p_source: String(donnees.get("source") ?? ""),
    p_date_fin: fin,
    p_date_publication: publication,
    p_mis_en_avant: donnees.get("mis_en_avant") === "on",
    p_soki_programme: donnees.get("soki") === "on",
  });
  if (error) return erreur(error.hint, error.message);
  rafraichir(true);
  updateTag(`marche-${marche}`);
  return { succes: "Modifications enregistrées." };
}

export async function changerEtatMarche(marche: number, action: "publier" | "programmer" | "brouillon" | "fermer"): Promise<EtatAction> {
  const { error } = await appeler("changer_etat_marche", { p_marche: marche, p_action: action });
  if (error) return erreur(error.hint, error.message);
  rafraichir(true);
  updateTag(`marche-${marche}`);
  const messages = { publier: "Marché en ligne.", programmer: "Marché programmé.", brouillon: "Repassé en brouillon.", fermer: "Mises fermées." };
  return { succes: messages[action] };
}

// Variante pour une fenêtre de confirmation (reçoit le formulaire, sans l'utiliser)
export async function fermerMarche(marche: number): Promise<EtatAction> {
  return changerEtatMarche(marche, "fermer");
}

export async function mettreEnAvant(marche: number, valeur: boolean): Promise<EtatAction> {
  const { error } = await appeler("mettre_en_avant", { p_marche: marche, p_valeur: valeur });
  if (error) return erreur(error.hint, error.message);
  rafraichir(true);
  return { succes: valeur ? "Mis en avant." : "Retiré de la mise en avant." };
}

export async function dupliquerMarche(marche: number): Promise<EtatCreation> {
  const { data, error } = await appeler("dupliquer_marche", { p_marche: marche });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: `Copie créée en brouillon (n° ${data}).`, id: data as number };
}

export async function supprimerMarche(marche: number, donnees: FormData): Promise<EtatAction> {
  const { data, error } = await appeler("supprimer_marche", { p_marche: marche, p_motif: String(donnees.get("motif") ?? "") });
  if (error) return erreur(error.hint, error.message);
  rafraichir(true);
  updateTag(`marche-${marche}`);
  return { succes: `Marché supprimé, ${data} mise(s) remboursée(s).` };
}

export async function creerModele(_etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const frequence = String(donnees.get("frequence") ?? "quotidienne");
  const { error } = await appeler("creer_modele_recurrent", {
    p_question: String(donnees.get("question") ?? ""),
    p_categorie: String(donnees.get("categorie") ?? ""),
    p_source: String(donnees.get("source") ?? ""),
    p_frequence: frequence,
    p_jour_semaine: frequence === "hebdomadaire" ? Number(donnees.get("jour_semaine")) : null,
    p_heure: String(donnees.get("heure") ?? "08:00"),
    p_duree_heures: Number(donnees.get("duree_heures")),
    p_soki: donnees.get("soki") === "on",
  });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: "Modèle créé. Les marchés sont programmés automatiquement 24 h à l'avance." };
}

export async function activerModele(modele: number, actif: boolean): Promise<EtatAction> {
  const { error } = await appeler("activer_modele", { p_modele: modele, p_actif: actif });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: actif ? "Modèle activé." : "Modèle en pause." };
}

// Ajout ou retrait (confirmé dans une fenêtre) : sens = « ajouter » ou « retirer »
export async function ajusterPieces(donnees: FormData): Promise<EtatAction> {
  const nom = String(donnees.get("nom") ?? "").trim().replace(/^@/, "");
  const sens = String(donnees.get("sens") ?? "ajouter");
  const montant = Number.parseInt(String(donnees.get("montant") ?? "").replace(/\s/g, ""), 10);
  if (!Number.isInteger(montant) || montant <= 0) return erreur("montant_ajustement_invalide");
  const cible = await idParNom(nom);
  if (!cible) return erreur("utilisateur_introuvable");
  const { data, error } = await appeler("ajuster_pieces", {
    p_utilisateur: cible.id,
    p_montant: sens === "retirer" ? -montant : montant,
    p_raison: String(donnees.get("raison") ?? ""),
  });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: `@${cible.nom_utilisateur} : nouveau solde ${data} pièces.` };
}

export async function bonusEnMasse(donnees: FormData): Promise<EtatAction> {
  const cible = String(donnees.get("cible") ?? "liste");
  const noms = String(donnees.get("noms") ?? "")
    .split(/[\s,;]+/)
    .map((n) => n.replace(/^@/, ""))
    .filter(Boolean);
  const { data, error } = await appeler("bonus_en_masse", {
    p_cible: cible,
    p_noms: cible === "liste" ? noms : null,
    p_communaute: cible === "communaute" ? Number(donnees.get("communaute")) : null,
    p_top: cible === "top" ? Number(donnees.get("top")) : null,
    p_periode: String(donnees.get("periode") ?? "semaine"),
    p_montant: Number.parseInt(String(donnees.get("montant") ?? "").replace(/\s/g, ""), 10),
    p_raison: String(donnees.get("raison") ?? ""),
  });
  if (error) return erreur(error.hint, error.message);
  const r = data as { comptes: number; total: number };
  rafraichir();
  return { succes: `Bonus versé à ${r.comptes} compte(s), ${r.total} pièces au total.` };
}

export async function modifierReglage(cle: string, numerique: boolean, _etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const brut = String(donnees.get("valeur") ?? "").trim();
  const { error } = await appeler("modifier_reglage", {
    p_cle: cle,
    p_valeur: numerique ? Number.parseInt(brut.replace(/\s/g, ""), 10) : null,
    p_texte: numerique ? null : brut,
  });
  if (error) return erreur(error.hint, error.message);
  updateTag("reglages");
  rafraichir(true);
  return { succes: "Enregistré." };
}

// Réglages du fil de marchés (coefficients décimaux, sections affichées ou cachées)
export async function modifierReglageFil(cle: string, _etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const brut = String(donnees.get("valeur") ?? "").trim().replace(/\s/g, "").replace(",", ".");
  const valeur = Number(brut);
  if (brut === "" || !Number.isFinite(valeur)) return erreur("hors_limites");
  const { error } = await appeler("modifier_reglage_fil", { p_cle: cle, p_valeur: valeur });
  if (error) return erreur(error.hint, error.message);
  // Les nouveaux coefficients comptent tout de suite (sans attendre les 10 minutes)
  if (cle.startsWith("coef_") || cle === "bonus_nouveau") await creerClientAdmin().rpc("calculer_scores_fil");
  updateTag("reglages-fil");
  updateTag("fil");
  rafraichir(true);
  return { succes: "Enregistré." };
}

// Recalcule les scores du fil tout de suite (normalement toutes les 10 minutes)
export async function recalculerScoresFil(): Promise<EtatAction> {
  if (!(await verifierAdmin())) return erreur("reserve_admin");
  const { data, error } = await creerClientAdmin().rpc("calculer_scores_fil");
  if (error) return erreur(null, error.message);
  updateTag("fil");
  rafraichir(true);
  return { succes: `Scores recalculés (${data} marchés).` };
}

// ---------------------------------------------------------------------
// Football, communautés
// ---------------------------------------------------------------------
export async function importerMaintenant(): Promise<EtatAction> {
  if (!(await verifierAdmin())) return erreur("reserve_admin");
  const { importerFootball } = await import("@/lib/football/import");
  const bilans = await importerFootball({ declenchePar: "admin", forcer: true });
  rafraichir(true);
  const texte = bilans
    .map((b) => `${b.type === "a_venir" ? "Matchs à venir" : "Résultats"} : ${b.statut} (${b.appels} requête(s), ${b.matchs} match(s))${b.statut === "erreur" || b.statut === "limite" ? ` — ${b.message}` : ""}`)
    .join(" · ");
  return bilans.some((b) => b.statut === "erreur") ? { erreur: texte } : { succes: texte };
}

export async function activerLigue(ligue: number, active: boolean): Promise<EtatAction> {
  const { error } = await appeler("activer_ligue", { p_ligue: ligue, p_active: active });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: active ? "Ligue activée." : "Ligue désactivée." };
}

export async function corrigerMatch(match: number, donnees: FormData): Promise<EtatAction> {
  const statut = String(donnees.get("statut") ?? "termine");
  const dom = donnees.get("buts_dom") === "" ? null : Number(donnees.get("buts_dom"));
  const ext = donnees.get("buts_ext") === "" ? null : Number(donnees.get("buts_ext"));
  const { error } = await appeler("corriger_match", { p_match: match, p_buts_dom: dom, p_buts_ext: ext, p_statut: statut });
  if (error) return erreur(error.hint, error.message);
  rafraichir(true);
  return { succes: statut === "termine" ? "Score enregistré, marché réglé." : "Match annulé, mises remboursées." };
}

export async function creerCommunaute(_etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const { error } = await appeler("creer_communaute", {
    p_nom: String(donnees.get("nom") ?? ""),
    p_type: String(donnees.get("type") ?? "autre"),
    p_description: String(donnees.get("description") ?? ""),
  });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: "Communauté créée." };
}

export async function creerDuel(_etat: EtatAction, donnees: FormData): Promise<EtatAction> {
  const { error } = await appeler("creer_duel", {
    p_titre: String(donnees.get("titre") ?? ""),
    p_a: Number(donnees.get("a")),
    p_b: Number(donnees.get("b")),
  });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: "Duel créé." };
}

export async function activerDuel(duel: number, actif: boolean): Promise<EtatAction> {
  const { error } = await appeler("activer_duel", { p_duel: duel, p_actif: actif });
  if (error) return erreur(error.hint, error.message);
  rafraichir();
  return { succes: actif ? "Duel affiché." : "Duel masqué." };
}
