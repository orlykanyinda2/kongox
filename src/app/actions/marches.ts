"use server";

import { refresh, updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { estCategorie } from "@/lib/marches/categories";

export type EtatPrediction = {
  erreur?: string;
  succes?: { libelle: string; montant: number; solde: number; restant: number };
};

export type EtatProposition = {
  erreur?: string;
  marcheId?: number;
};

// Les fonctions SQL renvoient un « hint » : on le traduit en message pour l'utilisateur.
async function messageErreur(hint: string | undefined, detail?: string) {
  const t = await getTranslations("erreursMarche");
  switch (hint) {
    case "connexion_requise":
    case "marche_ferme":
    case "montant_invalide":
    case "option_invalide":
    case "solde_insuffisant":
    case "question_invalide":
    case "categorie_invalide":
    case "date_invalide":
    case "source_invalide":
    case "trop_de_propositions":
      return t(hint);
    case "limite_quotidienne":
      return t("limite_quotidienne", { restant: Number(detail ?? 0) });
    default:
      return t("serveur");
  }
}

// ---------------------------------------------------------------------
// Miser des pièces sur une option (fonction SQL placer_prediction)
// ---------------------------------------------------------------------
export async function predire(_etat: EtatPrediction, donnees: FormData): Promise<EtatPrediction> {
  const marche = Number(donnees.get("marche"));
  const option = Number(donnees.get("option"));
  const montant = Number(donnees.get("montant"));
  const libelle = String(donnees.get("libelle") ?? "");

  if (!Number.isInteger(marche) || !Number.isInteger(option)) return { erreur: await messageErreur("option_invalide") };
  if (!Number.isInteger(montant) || montant < 1) return { erreur: await messageErreur("montant_invalide") };

  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc("placer_prediction", { p_marche: marche, p_option: option, p_montant: montant });
  if (error) {
    if (!error.hint) console.error("[prédiction]", error.code, error.message);
    return { erreur: await messageErreur(error.hint, error.details) };
  }

  const r = data as { solde: number; restant_aujourdhui: number };
  updateTag("marches");
  updateTag(`marche-${marche}`);
  refresh();
  return { succes: { libelle, montant, solde: r.solde, restant: r.restant_aujourdhui } };
}

// ---------------------------------------------------------------------
// Proposer une question (fonction SQL proposer_marche → statut en_attente)
// ---------------------------------------------------------------------
export async function proposer(_etat: EtatProposition, donnees: FormData): Promise<EtatProposition> {
  const question = String(donnees.get("question") ?? "").trim();
  const categorie = String(donnees.get("categorie") ?? "");
  const date = String(donnees.get("date_fin") ?? "");
  const heure = String(donnees.get("heure_fin") ?? "") || "20:00";
  const source = String(donnees.get("source") ?? "").trim();

  if (!estCategorie(categorie)) return { erreur: await messageErreur("categorie_invalide") };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(heure)) return { erreur: await messageErreur("date_invalide") };

  // L'heure saisie est l'heure de Kinshasa (UTC+1, sans heure d'été)
  const dateFin = new Date(`${date}T${heure}:00+01:00`);
  if (Number.isNaN(dateFin.getTime())) return { erreur: await messageErreur("date_invalide") };

  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc("proposer_marche", {
    p_question: question,
    p_categorie: categorie,
    p_date_fin: dateFin.toISOString(),
    p_source: source,
  });
  if (error) {
    if (!error.hint) console.error("[proposition]", error.code, error.message);
    return { erreur: await messageErreur(error.hint) };
  }

  refresh();
  return { marcheId: data as number };
}
