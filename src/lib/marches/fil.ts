import { cacheLife, cacheTag } from "next/cache";
import { creerClientPublic } from "@/lib/supabase/public";
import { marchesParIds, type Marche } from "./donnees";

// Fil de marchés (docs/ALGORITHME.md). Les sections sont calculées dans la base
// (fil_sections) à partir des scores recalculés toutes les 10 minutes par pg_cron.

export type CleSection = "soki" | "pour_toi" | "tendances" | "hausse" | "bientot" | "divise" | "nouveaux";
export type SectionFil = { cle: CleSection; titre: string; marches: Marche[] };

type SectionBrute = { cle: CleSection; titre: string; marches: number[] };

// Sections publiques, identiques pour tout le monde : mises en cache 60 secondes.
export async function sectionsFil(): Promise<SectionFil[]> {
  "use cache";
  cacheTag("marches", "fil");
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });

  const db = creerClientPublic();
  const { data, error } = await db.rpc("fil_sections", { p_exclure: [] });
  if (error) {
    console.error("[fil] sections :", error.message);
    return [];
  }
  const brutes = (data ?? []) as SectionBrute[];
  const marches = await marchesParIds(brutes.flatMap((s) => s.marches));
  const parId = new Map(marches.map((m) => [m.id, m]));
  return brutes
    .map((s) => ({ cle: s.cle, titre: s.titre, marches: s.marches.map((id) => parId.get(id)).filter((m): m is Marche => !!m) }))
    .filter((s) => s.marches.length > 0);
}

// Accueil : le Soki du jour (affiché dans le grand encadré du haut) et les autres sections.
// Sans Soki du jour, le premier marché du fil prend sa place (et quitte sa section : pas de doublon).
export async function filAccueil(): Promise<{ soki: Marche | null; sections: SectionFil[] }> {
  const toutes = await sectionsFil();
  const soki = toutes.find((s) => s.cle === "soki")?.marches[0];
  if (soki) return { soki, sections: toutes.filter((s) => s.cle !== "soki") };
  const premiere = toutes[0];
  if (!premiere) return { soki: null, sections: [] };
  const sections = [{ ...premiere, marches: premiere.marches.slice(1) }, ...toutes.slice(1)].filter((s) => s.marches.length > 0);
  return { soki: premiere.marches[0], sections };
}

// Réglages du fil (coefficients, sections affichées), en cache comme les autres réglages
export async function reglagesFil(): Promise<Record<string, number>> {
  "use cache";
  cacheTag("reglages", "reglages-fil");
  cacheLife({ stale: 300, revalidate: 300, expire: 86400 });

  const db = creerClientPublic();
  const { data, error } = await db.from("reglages_fil").select("cle, valeur");
  if (error) console.error("[fil] réglages :", error.message);
  return Object.fromEntries((data ?? []).map((r: { cle: string; valeur: number | string }) => [r.cle, Number(r.valeur)]));
}

// ---------------------------------------------------------------------
// Page /marches
// ---------------------------------------------------------------------
export const TRIS = ["tendance", "nouveaux", "bientot", "plus_mises", "plus_commentes"] as const;
export type Tri = (typeof TRIS)[number];
export const STATUTS = ["en_ligne", "bientot", "fermes", "regles", "tous"] as const;
export type StatutFiltre = (typeof STATUTS)[number];
export const TAILLE_PAGE = 12;

export type FiltresMarches = { q: string; categorie: string; statut: StatutFiltre; communaute: number | null; tri: Tri };

export type ResultatRecherche = { marches: Marche[]; total: number };

export async function rechercherMarches(f: FiltresMarches, decalage: number): Promise<ResultatRecherche> {
  "use cache";
  cacheTag("marches");
  cacheLife({ stale: 30, revalidate: 30, expire: 3600 });

  const db = creerClientPublic();
  const { data, error } = await db.rpc("rechercher_marches", {
    p_recherche: f.q.slice(0, 80),
    p_categorie: f.categorie,
    p_statut: f.statut,
    p_communaute: f.communaute,
    p_tri: f.tri,
    p_decalage: decalage,
    p_limite: TAILLE_PAGE,
  });
  if (error) {
    console.error("[fil] recherche :", error.message);
    return { marches: [], total: 0 };
  }
  const lignes = (data ?? []) as { id: number; total: number }[];
  const marches = await marchesParIds(lignes.map((l) => Number(l.id)));
  const parId = new Map(marches.map((m) => [m.id, m]));
  return {
    marches: lignes.map((l) => parId.get(Number(l.id))).filter((m): m is Marche => !!m),
    total: lignes.length ? Number(lignes[0].total) : 0,
  };
}

// Lecture des paramètres d'URL de /marches (toute valeur inconnue revient à la valeur par défaut)
export function lireFiltres(p: Record<string, string | string[] | undefined>): FiltresMarches {
  const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tri = un(p.tri) as Tri;
  const statut = un(p.statut) as StatutFiltre;
  const communaute = Number(un(p.communaute));
  return {
    q: un(p.q).trim().slice(0, 80),
    categorie: ["football", "musique", "politique", "vie_quotidienne"].includes(un(p.categorie)) ? un(p.categorie) : "",
    statut: STATUTS.includes(statut) ? statut : "en_ligne",
    communaute: Number.isInteger(communaute) && communaute > 0 ? communaute : null,
    tri: TRIS.includes(tri) ? tri : "tendance",
  };
}

// Communautés actives (filtre de /marches)
export async function communautesActives(): Promise<{ id: number; nom: string }[]> {
  "use cache";
  cacheTag("marches", "communautes");
  cacheLife({ stale: 60, revalidate: 60, expire: 86400 });

  const db = creerClientPublic();
  const { data, error } = await db.from("communautes").select("id, nom").eq("active", true).order("nom");
  if (error) console.error("[fil] communautés :", error.message);
  return (data ?? []) as { id: number; nom: string }[];
}
