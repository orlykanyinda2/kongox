import { cacheLife, cacheTag } from "next/cache";
import { creerClientPublic } from "@/lib/supabase/public";

// Résumé public d'un profil pour la carte image et les balises Open Graph (mis en cache 5 minutes)
export type ResumeProfil = { nom: string; score: number | null; reglees: number; predictions: number; abonnes: number; badges: string[] };

export async function resumeProfil(nom: string): Promise<ResumeProfil | null> {
  "use cache";
  cacheTag("profils");
  cacheLife({ stale: 300, revalidate: 300, expire: 86400 });
  const { data } = await creerClientPublic().rpc("profil_public", { p_nom: nom });
  const p = data as { nom: string; reglees: number; gagnees: number; predictions: number; abonnes: number; badges: string[] } | null;
  if (!p) return null;
  return {
    nom: p.nom,
    score: p.reglees ? Math.round((p.gagnees * 100) / p.reglees) : null,
    reglees: p.reglees,
    predictions: p.predictions,
    abonnes: p.abonnes,
    badges: p.badges ?? [],
  };
}
