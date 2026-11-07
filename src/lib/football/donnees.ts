import { cacheLife, cacheTag } from "next/cache";
import { creerClientPublic } from "@/lib/supabase/public";

// Lecture des matchs pour les pages publiques (cache 30 s, rafraîchi après chaque import ou mise).

export type MatchAffiche = {
  id: number;
  date_match: string;
  statut: "a_venir" | "en_cours" | "termine" | "annule" | "reporte";
  journee: string | null;
  buts_dom: number | null;
  buts_ext: number | null;
  ligue: { id: number; nom: string };
  dom: string;
  ext: string;
  marche_id: number | null;
  ouvert: boolean; // on peut encore miser
  pourcentages: [number, number, number]; // 1, N, 2
  volume: number;
};

type Ligne = {
  id: number;
  date_match: string;
  statut: MatchAffiche["statut"];
  journee: string | null;
  buts_dom: number | null;
  buts_ext: number | null;
  ligue: { id: number; nom: string };
  dom: { nom: string };
  ext: { nom: string };
  marche: { id: number; statut: string; date_fin: string; options: { ordre: number; total_mise: number }[] } | null;
};

const CHAMPS =
  "id, date_match, statut, journee, buts_dom, buts_ext, ligue:ligues(id, nom), dom:equipes!matchs_equipe_dom_id_fkey(nom), ext:equipes!matchs_equipe_ext_id_fkey(nom), " +
  "marche:marches!matchs_marche_id_fkey(id, statut, date_fin, options:options_marche!options_marche_marche_id_fkey(ordre, total_mise))";

// Pourcentages entiers qui font toujours 100 (méthode du plus grand reste)
export function pourcentages3(totaux: number[]): [number, number, number] {
  const total = totaux.reduce((s, v) => s + v, 0);
  if (total === 0) return [33, 34, 33];
  const bruts = totaux.map((v) => (v * 100) / total);
  const bas = bruts.map(Math.floor);
  let reste = 100 - bas.reduce((s, v) => s + v, 0);
  [...bruts.keys()].sort((a, b) => bruts[b] - bas[b] - (bruts[a] - bas[a])).forEach((i) => {
    if (reste > 0) {
      bas[i]++;
      reste--;
    }
  });
  return [bas[0], bas[1], bas[2]];
}

function enrichir(l: Ligne, maintenant: number): MatchAffiche {
  const opts = [...(l.marche?.options ?? [])].sort((a, b) => a.ordre - b.ordre).map((o) => o.total_mise);
  return {
    id: l.id,
    date_match: l.date_match,
    statut: l.statut,
    journee: l.journee,
    buts_dom: l.buts_dom,
    buts_ext: l.buts_ext,
    ligue: l.ligue,
    dom: l.dom.nom,
    ext: l.ext.nom,
    marche_id: l.marche?.id ?? null,
    ouvert: l.marche?.statut === "approuve" && new Date(l.marche.date_fin).getTime() > maintenant,
    pourcentages: pourcentages3(opts.length === 3 ? opts : [0, 0, 0]),
    volume: opts.reduce((s, v) => s + v, 0),
  };
}

export async function matchsAVenir(limite = 40, ligue?: number): Promise<MatchAffiche[]> {
  "use cache";
  cacheTag("matchs", "marches");
  cacheLife({ stale: 30, revalidate: 30, expire: 3600 });
  let r = creerClientPublic().from("matchs").select(CHAMPS).in("statut", ["a_venir", "en_cours"]).order("date_match").limit(limite);
  if (ligue) r = r.eq("ligue_id", ligue);
  const { data, error } = await r.returns<Ligne[]>();
  if (error) {
    console.error("[football] matchs à venir :", error.message);
    return [];
  }
  const maintenant = Date.now();
  return data.map((l) => enrichir(l, maintenant));
}

export async function resultatsRecents(limite = 20, ligue?: number): Promise<MatchAffiche[]> {
  "use cache";
  cacheTag("matchs", "marches");
  cacheLife({ stale: 30, revalidate: 30, expire: 3600 });
  let r = creerClientPublic().from("matchs").select(CHAMPS).in("statut", ["termine", "annule", "reporte"]).order("date_match", { ascending: false }).limit(limite);
  if (ligue) r = r.eq("ligue_id", ligue);
  const { data, error } = await r.returns<Ligne[]>();
  if (error) return [];
  const maintenant = Date.now();
  return data.map((l) => enrichir(l, maintenant));
}

export async function matchDuMarche(marche: number): Promise<MatchAffiche | null> {
  "use cache";
  cacheTag("matchs", `marche-${marche}`);
  cacheLife({ stale: 30, revalidate: 30, expire: 3600 });
  const { data } = await creerClientPublic().from("matchs").select(CHAMPS).eq("marche_id", marche).maybeSingle<Ligne>();
  return data ? enrichir(data, Date.now()) : null;
}

export async function liguesActives(): Promise<{ id: number; nom: string }[]> {
  "use cache";
  cacheTag("matchs");
  cacheLife("hours");
  const { data } = await creerClientPublic().from("ligues").select("id, nom").eq("active", true).order("ordre");
  return data ?? [];
}
