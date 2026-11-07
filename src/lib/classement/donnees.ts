import { cacheLife, cacheTag } from "next/cache";
import { creerClientPublic } from "@/lib/supabase/public";

// Classements publics (score Mayele) et duels de communautés, mis en cache 60 s.

export type Periode = "semaine" | "mois" | "tout";
export const PERIODES: { cle: Periode; libelle: string }[] = [
  { cle: "semaine", libelle: "Cette semaine" },
  { cle: "mois", libelle: "Ce mois" },
  { cle: "tout", libelle: "Depuis le début" },
];

export type LigneClassement = {
  rang: number;
  utilisateur_id: string;
  nom_utilisateur: string;
  score_mayele: number;
  predictions_reglees: number;
  predictions_gagnees: number;
  solde_pieces: number;
  icone?: string | null;
  photo?: string | null;
  elite?: boolean;
};

// Ajoute l'icône (ou la photo) de chaque personne d'un classement, en une requête
export async function avecIcones(lignes: LigneClassement[]): Promise<LigneClassement[]> {
  if (lignes.length === 0) return lignes;
  const db = creerClientPublic();
  const { data } = await db.from("utilisateurs").select("id, icone, photo, icone_info:icones!utilisateurs_icone_fk(niveau)").in("id", lignes.map((l) => l.utilisateur_id));
  const parId = new Map(((data ?? []) as unknown as { id: string; icone: string | null; photo: string | null; icone_info: { niveau: string } | null }[]).map((u) => [u.id, u]));
  return lignes.map((l) => {
    const u = parId.get(l.utilisateur_id);
    return { ...l, icone: u?.icone ?? null, photo: u?.photo ?? null, elite: !u?.photo && u?.icone_info?.niveau === "elite" };
  });
}

export type Duel = { id: number; titre: string; nom_a: string; score_a: number; nom_b: string; score_b: number; part_a: number };

export function estPeriode(v: unknown): v is Periode {
  return v === "semaine" || v === "mois" || v === "tout";
}

export async function classementPublic(periode: Periode, limite = 50): Promise<LigneClassement[]> {
  "use cache";
  cacheTag("classement", "marches");
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });
  const { data, error } = await creerClientPublic().rpc("classement", { p_periode: periode, p_limite: limite, p_amis: false });
  if (error) {
    console.error("[classement]", error.message);
    return [];
  }
  return avecIcones((data as LigneClassement[]).map((l) => ({ ...l, rang: Number(l.rang), score_mayele: Number(l.score_mayele), solde_pieces: Number(l.solde_pieces) })));
}

export async function duelsPublics(periode: Periode): Promise<Duel[]> {
  "use cache";
  cacheTag("classement", "marches");
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });
  const { data } = await creerClientPublic().rpc("duels", { p_periode: periode });
  return ((data ?? []) as Duel[]).map((d) => ({ ...d, score_a: Number(d.score_a), score_b: Number(d.score_b), part_a: Number(d.part_a) }));
}

export type Gagnant = { nom_utilisateur: string; type: string; description: string | null; sponsor: string | null; envoye_le: string };

// Derniers gagnants de cadeaux (60 jours) : nom, cadeau, sponsor. Jamais le numéro.
export async function derniersGagnants(limite = 5): Promise<Gagnant[]> {
  "use cache";
  cacheTag("cadeaux");
  cacheLife({ stale: 120, revalidate: 120, expire: 86400 });
  const { data, error } = await creerClientPublic().rpc("derniers_gagnants", { p_limite: limite });
  if (error) console.error("[cadeaux] derniers gagnants :", error.message);
  return (data ?? []) as Gagnant[];
}
