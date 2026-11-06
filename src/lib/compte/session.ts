import "server-only";
import { cache } from "react";
import { creerClientServeur } from "@/lib/supabase/serveur";

export type UtilisateurConnecte = {
  id: string;
  nom_utilisateur: string;
  role: string;
  solde_pieces: number;
  serie_jours: number;
};

// Utilisateur connecté (ou null). Une seule lecture par requête grâce à cache().
// Lit les cookies : à utiliser dans un composant entouré de <Suspense>.
export const utilisateurConnecte = cache(async (): Promise<UtilisateurConnecte | null> => {
  const supabase = await creerClientServeur();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;
  const { data: u } = await supabase
    .from("utilisateurs")
    .select("id, nom_utilisateur, role, solde_pieces, serie_jours")
    .eq("id", id)
    .maybeSingle<UtilisateurConnecte>();
  return u ?? null;
});
