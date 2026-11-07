import { creerClientServeur } from "@/lib/supabase/serveur";
import { NouveauBadge } from "./NouveauBadge";
import type { Niveau } from "./BadgeIcone";

// Badges gagnés pas encore montrés (dans un <Suspense> de la mise en page)
export async function NouveauBadgeServeur() {
  const supabase = await creerClientServeur();
  const { data: session } = await supabase.auth.getClaims();
  if (!session?.claims?.sub) return null;
  const { data } = await supabase.rpc("badges_a_montrer");
  const badges = (data ?? []) as { code: string; nom: string; description: string; glyphe: string; niveau: Niveau }[];
  return badges.length ? <NouveauBadge badges={badges} /> : null;
}
