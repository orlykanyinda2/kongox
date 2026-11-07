import { messagesSalon, type CibleSalon } from "@/lib/chat/donnees";
import { utilisateurConnecte } from "@/lib/compte/session";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { lireReglages } from "@/lib/reglages";
import { Salon, type EtatEcriture } from "./Salon";

// Prépare un salon : derniers messages, et ce que la personne peut faire (écrire, signaler).
// À placer dans un <Suspense>.
export async function SalonServeur({ cible, type }: { cible: CibleSalon; type: "marche" | "match" | "communaute" }) {
  const [{ messages, total }, u, reglages] = await Promise.all([messagesSalon(cible), utilisateurConnecte(), lireReglages()]);

  let ecriture: EtatEcriture = "connexion";
  if (u?.invite) {
    ecriture = "invite";
  } else if (u) {
    ecriture = "ok";
    const supabase = await creerClientServeur();
    const [{ data: blocage }, membre] = await Promise.all([
      supabase.from("blocages_chat").select("jusqu").eq("utilisateur_id", u.id).gt("jusqu", new Date().toISOString()).maybeSingle(),
      "communaute" in cible
        ? supabase.from("membres_communaute").select("utilisateur_id").eq("communaute_id", cible.communaute).eq("utilisateur_id", u.id).maybeSingle()
        : Promise.resolve({ data: true }),
    ]);
    if (blocage) ecriture = "bloque";
    else if (!membre.data) ecriture = "membres";
  }

  return (
    <Salon
      cible={cible}
      type={type}
      initiaux={messages}
      total={total}
      ecriture={ecriture}
      moi={u && !u.invite ? u.nom_utilisateur : null}
      longueurMax={Number(reglages.chat_longueur_max ?? 500)}
    />
  );
}
