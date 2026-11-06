"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { getTranslations } from "next-intl/server";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { emailCache, nomValide, MDP_LONGUEUR_MAX, MDP_LONGUEUR_MIN } from "@/lib/compte/nomUtilisateur";
import { normaliserTelephone } from "@/lib/compte/telephone";

export type EtatFormulaire = {
  erreur?: string;
  succes?: string;
  nom?: string; // garde le nom saisi si le formulaire est renvoyé avec une erreur
};

export type ResultatBonus = {
  accorde: boolean;
  bonus: number;
  bonus_serie: number;
  serie_jours: number;
  solde: number;
};

// ---------------------------------------------------------------------
// Inscription : nom d'utilisateur + mot de passe
// ---------------------------------------------------------------------
export async function inscrire(_etat: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const t = await getTranslations("erreurs");
  const nom = String(donnees.get("nom") ?? "").trim();
  const motDePasse = String(donnees.get("mot_de_passe") ?? "");
  const confirmation = String(donnees.get("confirmation") ?? "");

  if (!nomValide(nom)) return { erreur: t("nomFormat"), nom };
  if (motDePasse.length < MDP_LONGUEUR_MIN || motDePasse.length > MDP_LONGUEUR_MAX) {
    return { erreur: t("mdpLongueur", { min: MDP_LONGUEUR_MIN }), nom };
  }
  if (motDePasse !== confirmation) return { erreur: t("mdpDifferents"), nom };

  // Création côté serveur avec la clé service role : le compte est confirmé tout de suite.
  // Le déclencheur SQL crée le profil et verse les 1 000 pièces dans la même transaction.
  const admin = creerClientAdmin();

  const { data: libre, error: erreurNom } = await admin.rpc("nom_utilisateur_disponible", { p_nom: nom });
  if (erreurNom) {
    console.error("[inscription] vérification du nom :", erreurNom.message);
    return { erreur: t("serveur"), nom };
  }
  if (!libre) return { erreur: t("nomPris"), nom };

  const { error: erreurCreation } = await admin.auth.admin.createUser({
    email: emailCache(nom),
    password: motDePasse,
    email_confirm: true,
    user_metadata: { nom_utilisateur: nom },
  });
  if (erreurCreation) {
    console.error("[inscription] création du compte :", erreurCreation.code, erreurCreation.message);
    return { erreur: erreurCreation.code === "email_exists" ? t("nomPris") : t("serveur"), nom };
  }

  const supabase = await creerClientServeur();
  const { error: erreurConnexion } = await supabase.auth.signInWithPassword({
    email: emailCache(nom),
    password: motDePasse,
  });
  if (erreurConnexion) {
    console.error("[inscription] connexion après inscription :", erreurConnexion.code, erreurConnexion.message);
    return { erreur: t("connexionApresInscription"), nom };
  }

  redirect("/profil");
}

// ---------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------
export async function connecter(_etat: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const t = await getTranslations("erreurs");
  const nom = String(donnees.get("nom") ?? "").trim();
  const motDePasse = String(donnees.get("mot_de_passe") ?? "");

  if (!nomValide(nom) || !motDePasse) return { erreur: t("identifiants"), nom };

  const supabase = await creerClientServeur();
  const { error } = await supabase.auth.signInWithPassword({ email: emailCache(nom), password: motDePasse });
  if (error) {
    if (error.code !== "invalid_credentials") {
      console.error("[connexion]", error.code, error.message);
      return { erreur: t("serveur"), nom };
    }
    return { erreur: t("identifiants"), nom };
  }

  redirect("/profil");
}

// ---------------------------------------------------------------------
// Déconnexion
// ---------------------------------------------------------------------
export async function deconnecter() {
  const supabase = await creerClientServeur();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------------------------------------------------------------------
// Coordonnées facultatives : téléphone (pour les cadeaux) et e-mail de contact
// ---------------------------------------------------------------------
export async function mettreAJourCoordonnees(_etat: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const t = await getTranslations("erreurs");
  const tp = await getTranslations("profil");
  const supabase = await creerClientServeur();

  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return { erreur: t("connexionRequise") };

  const maj: { telephone?: string | null; email_contact?: string | null } = {};

  if (donnees.has("telephone")) {
    const saisie = String(donnees.get("telephone") ?? "").trim();
    if (saisie === "") {
      maj.telephone = null;
    } else {
      const numero = normaliserTelephone(saisie);
      if (!numero) return { erreur: t("telephoneFormat") };
      maj.telephone = numero;
    }
  }

  if (donnees.has("email_contact")) {
    const saisie = String(donnees.get("email_contact") ?? "").trim().toLowerCase();
    if (saisie === "") {
      maj.email_contact = null;
    } else if (saisie.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(saisie)) {
      return { erreur: t("emailFormat") };
    } else if (saisie.endsWith("@kongox.local")) {
      return { erreur: t("emailFormat") };
    } else {
      maj.email_contact = saisie;
    }
  }

  const { error } = await supabase.from("coordonnees_utilisateurs").update(maj).eq("utilisateur_id", id);
  if (error) {
    if (error.code === "23505") return { erreur: t("telephonePris") };
    if (error.code === "23514") return { erreur: maj.telephone !== undefined ? t("telephoneFormat") : t("emailFormat") };
    console.error("[coordonnées]", error.code, error.message);
    return { erreur: t("serveur") };
  }

  refresh();
  return { succes: tp("enregistre") };
}

// ---------------------------------------------------------------------
// Bonus quotidien : 100 pièces par jour, +200 tous les 7 jours de suite
// ---------------------------------------------------------------------
export async function reclamerBonus(): Promise<ResultatBonus | null> {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc("reclamer_bonus_quotidien");
  if (error) {
    console.error("[bonus quotidien]", error.code, error.message);
    return null;
  }
  const resultat = data as ResultatBonus;
  if (resultat.accorde) refresh();
  return resultat;
}
