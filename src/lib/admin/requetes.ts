import "server-only";
import { creerClientServeur } from "@/lib/supabase/serveur";

// Identifiant d'un compte à partir de son nom (sans tenir compte des majuscules), ou null
export async function idParNomPublic(nom: string): Promise<string | null> {
  const supabase = await creerClientServeur();
  const motif = nom.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data } = await supabase.from("utilisateurs").select("id, nom_utilisateur").ilike("nom_utilisateur", motif).limit(5);
  return data?.find((u) => u.nom_utilisateur.toLowerCase() === nom.toLowerCase())?.id ?? null;
}
