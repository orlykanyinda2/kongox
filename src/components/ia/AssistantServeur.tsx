import { Assistant } from "./Assistant";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { lireReglages } from "@/lib/reglages";
import { utilisateurConnecte } from "@/lib/compte/session";
import { ReserveAuxComptes } from "@/components/compte/ReserveAuxComptes";

// Prépare l'assistant : connecté ou non, et questions restantes aujourd'hui.
// Si l'assistant est désactivé (Admin › Réglages, ia_active = 0), rien n'est affiché.
export async function AssistantServeur({ marche, grand = false }: { marche?: number; grand?: boolean }) {
  const reglages = await lireReglages();
  if (Number(reglages.ia_active) === 0 || !process.env.ANTHROPIC_API_KEY) return null;
  const u = await utilisateurConnecte();
  if (u?.invite) return <ReserveAuxComptes fonction="assistant" />;
  const supabase = await creerClientServeur();
  const connecte = Boolean(u);
  let restantes = Number(reglages.ia_questions_par_jour ?? 20);
  if (connecte) {
    const { data: n } = await supabase.rpc("questions_ia_restantes");
    if (typeof n === "number") restantes = n;
  }
  return <Assistant marche={marche} connecte={connecte} restantes={restantes} grand={grand} />;
}
