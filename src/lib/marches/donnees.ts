import { cacheLife, cacheTag } from "next/cache";
import { creerClientPublic } from "@/lib/supabase/public";
import type { Categorie } from "./categories";

// Données publiques des marchés, mises en cache 30 secondes.
// Après une mise ou une proposition, les Server Actions appellent updateTag("marches").

export type OptionMarche = { id: number; libelle: string; ordre: number; total_mise: number };

export type Marche = {
  id: number;
  question: string;
  categorie: Categorie;
  date_fin: string;
  source: string;
  statut: "en_attente" | "approuve" | "refuse" | "ferme" | "regle";
  soki_du_jour: boolean;
  mis_en_avant: boolean;
  type_reponse: "oui_non" | "choix_multiples" | "1n2";
  option_gagnante_id: number | null;
  lien_resultat: string | null;
  motif: string | null;
  auteur: string | null;
  options: OptionMarche[];
  volume: number; // pièces misées en tout
  pourcentageOui: number; // 0 à 100, arrondi
  ouvert: boolean; // on peut encore miser
  finLibelle: string; // « Ferme dans 6 j », « Fermé »…
};

export type PointHistorique = { moment: string; pourcentage: number };

const CHAMPS =
  "id, question, categorie, type_reponse, date_fin, source, statut, soki_du_jour, mis_en_avant, option_gagnante_id, lien_resultat, motif, " +
  "auteur:utilisateurs!marches_auteur_id_fkey(nom_utilisateur), " +
  "options:options_marche!options_marche_marche_id_fkey(id, libelle, ordre, total_mise)";

type Ligne = Omit<Marche, "auteur" | "volume" | "pourcentageOui" | "ouvert" | "finLibelle"> & {
  auteur: { nom_utilisateur: string } | null;
};

function delaiFermeture(dateFin: string, maintenant: number) {
  const ms = new Date(dateFin).getTime() - maintenant;
  if (ms <= 0) return "Fermé";
  const heures = ms / 3_600_000;
  if (heures < 1) return "Ferme dans moins d'1 h";
  if (heures < 24) return `Ferme dans ${Math.floor(heures)} h`;
  const jours = Math.floor(heures / 24);
  if (jours < 60) return `Ferme dans ${jours} j`;
  return `Ferme dans ${Math.round(jours / 30)} mois`;
}

export function pourcentageOui(options: OptionMarche[]) {
  const total = options.reduce((s, o) => s + o.total_mise, 0);
  const oui = options.find((o) => o.ordre === 0)?.total_mise ?? 0;
  return total === 0 ? 50 : Math.round((oui * 100) / total);
}

function enrichir(l: Ligne, maintenant: number): Marche {
  const options = [...l.options].sort((a, b) => a.ordre - b.ordre);
  return {
    ...l,
    auteur: l.auteur?.nom_utilisateur ?? null,
    options,
    volume: options.reduce((s, o) => s + o.total_mise, 0),
    pourcentageOui: pourcentageOui(options),
    ouvert: l.statut === "approuve" && new Date(l.date_fin).getTime() > maintenant,
    finLibelle: l.statut === "regle" ? "Réglé" : delaiFermeture(l.date_fin, maintenant),
  };
}

// Marchés ouverts, du plus misé au moins misé
export async function listerMarchesOuverts(): Promise<Marche[]> {
  "use cache";
  cacheTag("marches");
  cacheLife({ stale: 30, revalidate: 30, expire: 3600 });

  const supabase = creerClientPublic();
  const { data, error } = await supabase
    .from("marches")
    .select(CHAMPS)
    .eq("statut", "approuve")
    .eq("type_reponse", "oui_non")
    .gt("date_fin", new Date().toISOString())
    .returns<Ligne[]>();

  if (error) {
    console.error("[marchés] liste :", error.message);
    return [];
  }
  const maintenant = Date.now();
  return data
    .map((l) => enrichir(l, maintenant))
    .sort((a, b) => Number(b.mis_en_avant) - Number(a.mis_en_avant) || b.volume - a.volume || a.date_fin.localeCompare(b.date_fin));
}

export async function obtenirMarche(id: number): Promise<Marche | null> {
  "use cache";
  cacheTag("marches", `marche-${id}`);
  cacheLife({ stale: 30, revalidate: 30, expire: 3600 });

  const supabase = creerClientPublic();
  const { data, error } = await supabase.from("marches").select(CHAMPS).eq("id", id).maybeSingle<Ligne>();
  if (error) console.error("[marchés] marché", id, ":", error.message);
  return data ? enrichir(data, Date.now()) : null;
}

export async function historiqueMarche(id: number): Promise<PointHistorique[]> {
  "use cache";
  cacheTag("marches", `marche-${id}`);
  cacheLife({ stale: 30, revalidate: 30, expire: 3600 });

  const supabase = creerClientPublic();
  const { data, error } = await supabase.rpc("historique_marche", { p_marche: id });
  if (error) {
    console.error("[marchés] historique", id, ":", error.message);
    return [];
  }
  return (data as { moment: string; pourcentage_oui: number }[]).map((p) => ({
    moment: p.moment,
    pourcentage: Number(p.pourcentage_oui),
  }));
}
