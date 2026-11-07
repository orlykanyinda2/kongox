import "server-only";
import { refresh, updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { creerClientServeur } from "@/lib/supabase/serveur";

// Outils partagés par les Server Actions du panneau admin (pas des actions eux-mêmes).

export type EtatAction = { erreur?: string; succes?: string };

const CONNUS = [
  "reserve_admin", "statut_invalide", "decision_en_attente", "question_invalide", "categorie_invalide", "date_invalide",
  "source_invalide", "lien_obligatoire", "option_invalide", "soi_meme", "utilisateur_introuvable", "numero_manquant",
  "motivation_invalide", "deja_curateur", "candidature_en_attente", "connexion_requise",
  "verrouille_mises", "date_publication_invalide", "motif_obligatoire", "frequence_invalide", "montant_ajustement_invalide",
  "raison_obligatoire", "solde_negatif", "montant_masse_invalide", "aucun_compte", "trop_de_comptes", "hors_limites",
];

// Traduit le « hint » renvoyé par les fonctions SQL en message français
export async function erreur(hint: string | undefined | null, detail?: string): Promise<EtatAction> {
  const t = await getTranslations("erreursAdmin");
  if (hint && CONNUS.includes(hint)) return { erreur: t(hint) };
  if (detail) console.error("[admin]", detail);
  return { erreur: t("serveur") };
}

// Appelle une fonction SQL au nom de l'utilisateur connecté (la fonction vérifie ses droits)
export async function appeler(fonction: string, params: Record<string, unknown>) {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc(fonction, params);
  return { data, error };
}

export function rafraichir(marches = false) {
  if (marches) updateTag("marches");
  refresh();
}

// Échappe _ et % pour une recherche ILIKE exacte (sans tenir compte des majuscules)
function motifExact(nom: string) {
  return nom.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function idParNom(nom: string): Promise<{ id: string; nom_utilisateur: string; role: string } | null> {
  const supabase = await creerClientServeur();
  const { data } = await supabase.from("utilisateurs").select("id, nom_utilisateur, role").ilike("nom_utilisateur", motifExact(nom)).limit(5);
  return data?.find((u) => u.nom_utilisateur.toLowerCase() === nom.toLowerCase()) ?? null;
}

export async function verifierAdmin() {
  const supabase = await creerClientServeur();
  const { data } = await supabase.rpc("est_admin");
  return data === true;
}

// Date + heure saisies à l'heure de Kinshasa (UTC+1) → ISO, ou null
export function dateKinshasa(date: FormDataEntryValue | null, heure: FormDataEntryValue | null): string | null {
  const d = String(date ?? "");
  const h = String(heure ?? "") || "20:00";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(h)) return null;
  const x = new Date(`${d}T${h}:00+01:00`);
  return Number.isNaN(x.getTime()) ? null : x.toISOString();
}
