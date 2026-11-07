import { after } from "next/server";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { creerClientAdmin } from "@/lib/supabase/admin";

// Reçoit les événements du fil (affichage, clic, prédiction, visite) envoyés par SuiviFil.
// Répond tout de suite (204) ; l'enregistrement se fait après la réponse.
// Aucune donnée personnelle : identifiants aléatoires du navigateur, et l'utilisateur s'il est connecté.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TYPES = new Set(["affiche", "clic", "prediction", "visite"]);
const TAILLE_MAX = 16_000; // octets

export async function POST(requete: Request) {
  const texte = await requete.text();
  if (texte.length > TAILLE_MAX) return new Response(null, { status: 413 });

  let corps: { visiteur_id?: unknown; visite_id?: unknown; evenements?: unknown };
  try {
    corps = JSON.parse(texte);
  } catch {
    return new Response(null, { status: 400 });
  }
  const { visiteur_id, visite_id, evenements } = corps;
  if (typeof visiteur_id !== "string" || !UUID.test(visiteur_id) || typeof visite_id !== "string" || !UUID.test(visite_id) || !Array.isArray(evenements)) {
    return new Response(null, { status: 400 });
  }

  const lot = evenements
    .slice(0, 50)
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object" && TYPES.has(String((e as Record<string, unknown>).type)))
    .map((e) => ({
      type: String(e.type),
      marche_id: Number.isInteger(e.marche_id) && Number(e.marche_id) > 0 ? e.marche_id : null,
      section: typeof e.section === "string" && /^[a-z_]{2,20}$/.test(e.section) ? e.section : null,
      position: Number.isInteger(e.position) && Number(e.position) >= 0 && Number(e.position) < 1000 ? e.position : null,
      page: typeof e.page === "string" ? e.page.slice(0, 40) : null,
      visiteur_id,
      visite_id,
    }));
  if (lot.length === 0) return new Response(null, { status: 204 });

  after(async () => {
    try {
      const { data } = await (await creerClientServeur()).auth.getClaims();
      const utilisateur = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
      const { error } = await creerClientAdmin().rpc("enregistrer_evenements_fil", { p_evenements: lot, p_utilisateur: utilisateur });
      if (error) console.error("[fil] événements :", error.message);
    } catch (e) {
      console.error("[fil] événements :", e instanceof Error ? e.message : e);
    }
  });
  return new Response(null, { status: 204 });
}
