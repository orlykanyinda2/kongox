import "server-only";
import { revalidateTag } from "next/cache";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { apiFootball } from "./apiFootball";
import type { FournisseurFootball } from "./types";

// Import économe des matchs (budget ~100 requêtes par jour chez API-Football) :
// - « à venir » : une fois par jour, 1 requête par ligue active ;
// - « résultats » : seulement pour les matchs dont la fin estimée (coup d'envoi + 2 h) est passée,
//   20 matchs par requête ; rien n'est demandé s'il n'y a rien à mettre à jour.
// Avant chaque requête, reserver_appel_api() compte et refuse au-delà de la limite du jour.
// Si le fournisseur ne répond pas, on garde les données déjà en base : le site continue de marcher.

const fournisseur: FournisseurFootball = apiFootball;

type Besoins = {
  a_venir: boolean;
  resultats: number[];
  saison: number;
  decalage_jours: number;
  jours_a_venir: number;
  ligues: { id: number; id_externe: number; nom: string }[];
};

export type BilanImport = { type: "a_venir" | "resultats"; statut: string; appels: number; matchs: number; message: string };

// Jour AAAA-MM-JJ à Kinshasa, décalé de n jours
function jour(decalage: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kinshasa" }).format(new Date(Date.now() + decalage * 86_400_000));
}

async function importerAVenir(b: Besoins, declenchePar: string): Promise<BilanImport> {
  const db = creerClientAdmin();
  const { data: id } = await db.rpc("commencer_import", { p_type: "a_venir", p_declenche_par: declenchePar });
  if (!id) return { type: "a_venir", statut: "deja_en_cours", appels: 0, matchs: 0, message: "Un import est déjà en cours." };

  // Mode test : on lit la saison passée aux mêmes dates qu'aujourd'hui moins le décalage
  const du = jour(-b.decalage_jours);
  const au = jour(-b.decalage_jours + b.jours_a_venir);
  let appels = 0;
  let total = 0;
  const erreurs: string[] = [];
  let statut = "ok";

  for (const ligue of b.ligues) {
    const { data: autorise } = await db.rpc("reserver_appel_api", { p_fournisseur: fournisseur.nom });
    if (!autorise) {
      statut = "limite";
      erreurs.push("Limite de requêtes du jour atteinte : import arrêté.");
      break;
    }
    appels++;
    const r = await fournisseur.matchsEntre(ligue.id_externe, b.saison, du, au);
    if (r.erreur) {
      erreurs.push(`${ligue.nom} : ${r.erreur}`);
      continue;
    }
    const { data: n, error } = await db.rpc("enregistrer_matchs", { p_fournisseur: fournisseur.nom, p_matchs: r.matchs });
    if (error) erreurs.push(`${ligue.nom} : ${error.message}`);
    else total += Number(n ?? 0);
  }
  if (statut === "ok" && erreurs.length) statut = erreurs.length === b.ligues.length ? "erreur" : "ok";

  const message = erreurs.length ? erreurs.join(" | ") : `${total} matchs du ${du} au ${au}.`;
  await db.rpc("terminer_import", { p_import: id, p_statut: statut, p_appels: appels, p_matchs: total, p_message: message });
  return { type: "a_venir", statut, appels, matchs: total, message };
}

async function importerResultats(b: Besoins, declenchePar: string): Promise<BilanImport> {
  const db = creerClientAdmin();
  if (b.resultats.length === 0) {
    // Rien à demander au fournisseur ; on publie quand même les scores déjà connus (mode test)
    await db.rpc("appliquer_resultats");
    return { type: "resultats", statut: "rien_a_faire", appels: 0, matchs: 0, message: "Aucun résultat à demander." };
  }
  const { data: id } = await db.rpc("commencer_import", { p_type: "resultats", p_declenche_par: declenchePar });
  if (!id) return { type: "resultats", statut: "deja_en_cours", appels: 0, matchs: 0, message: "Un import est déjà en cours." };

  const { data: autorise } = await db.rpc("reserver_appel_api", { p_fournisseur: fournisseur.nom });
  if (!autorise) {
    const message = "Limite de requêtes du jour atteinte : import arrêté.";
    await db.rpc("terminer_import", { p_import: id, p_statut: "limite", p_appels: 0, p_matchs: 0, p_message: message });
    return { type: "resultats", statut: "limite", appels: 0, matchs: 0, message };
  }
  const r = await fournisseur.matchsParIds(b.resultats);
  let statut = "ok";
  let message = `${r.matchs.length} résultats reçus.`;
  let total = 0;
  if (r.erreur) {
    statut = "erreur";
    message = r.erreur;
  } else {
    const { data: n, error } = await db.rpc("enregistrer_matchs", { p_fournisseur: fournisseur.nom, p_matchs: r.matchs });
    if (error) {
      statut = "erreur";
      message = error.message;
    } else total = Number(n ?? 0);
  }
  await db.rpc("terminer_import", { p_import: id, p_statut: statut, p_appels: 1, p_matchs: total, p_message: message });
  return { type: "resultats", statut, appels: 1, matchs: total, message };
}

// Lance ce qui est nécessaire. forcer = « Importer maintenant » (admin) : refait les matchs à venir même si c'est déjà fait aujourd'hui.
export async function importerFootball({ declenchePar, forcer = false }: { declenchePar: "automatique" | "admin" | "cron"; forcer?: boolean }) {
  const db = creerClientAdmin();
  const { data, error } = await db.rpc("besoins_import");
  if (error || !data) return [{ type: "a_venir", statut: "erreur", appels: 0, matchs: 0, message: error?.message ?? "Base injoignable." }] as BilanImport[];
  const b = data as Besoins;
  const bilans: BilanImport[] = [];
  if (b.a_venir || forcer) bilans.push(await importerAVenir(b, declenchePar));
  bilans.push(await importerResultats(b, declenchePar));
  if (bilans.some((x) => x.matchs > 0)) {
    // revalidateTag (et non updateTag) : l'import tourne aussi hors des Server Actions
    revalidateTag("matchs", "max");
    revalidateTag("marches", "max");
  }
  return bilans;
}

// Déclenchement « paresseux » depuis les pages publiques : au plus une vérification toutes les 10 minutes par serveur.
let derniereVerification = 0;
export async function importerSiBesoin() {
  if (!process.env.API_FOOTBALL_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  if (Date.now() - derniereVerification < 10 * 60_000) return;
  derniereVerification = Date.now();
  try {
    await importerFootball({ declenchePar: "automatique" });
  } catch (e) {
    console.error("[football] import automatique :", e instanceof Error ? e.message : e);
  }
}
