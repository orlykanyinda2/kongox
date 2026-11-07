import "server-only";
import type { FournisseurFootball, MatchNormalise, ReponseFournisseur } from "./types";

// Adaptateur API-Football (v3). La clé API_FOOTBALL_KEY reste côté serveur (.env.local).
// Chaque appel de ce fichier = 1 requête comptée par le fournisseur.

const BASE = "https://v3.football.api-sports.io";

type FixtureApi = {
  fixture: { id: number; date: string; status: { short: string } };
  league: { id: number; season: number; round: string | null };
  teams: { home: { id: number; name: string; logo: string | null }; away: { id: number; name: string; logo: string | null } };
  goals: { home: number | null; away: number | null };
  score: { fulltime: { home: number | null; away: number | null } };
};

function normaliser(f: FixtureApi): MatchNormalise {
  // Pour le 1 N 2, on garde le score à la fin du temps réglementaire (90 minutes)
  const ft = f.score?.fulltime ?? { home: null, away: null };
  return {
    id_externe: f.fixture.id,
    ligue_externe: f.league.id,
    saison: f.league.season,
    journee: f.league.round,
    date_api: f.fixture.date,
    statut_api: f.fixture.status.short,
    buts_dom: ft.home ?? f.goals.home,
    buts_ext: ft.away ?? f.goals.away,
    dom: { id_externe: f.teams.home.id, nom: f.teams.home.name, logo_url: f.teams.home.logo },
    ext: { id_externe: f.teams.away.id, nom: f.teams.away.name, logo_url: f.teams.away.logo },
  };
}

async function appeler(chemin: string): Promise<ReponseFournisseur> {
  const cle = process.env.API_FOOTBALL_KEY;
  if (!cle) return { matchs: [], erreur: "API_FOOTBALL_KEY manque dans .env.local." };
  try {
    const rep = await fetch(`${BASE}${chemin}`, {
      headers: { "x-apisports-key": cle },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!rep.ok) return { matchs: [], erreur: `API-Football a répondu ${rep.status}.` };
    const corps = (await rep.json()) as { errors?: Record<string, string> | unknown[]; response?: FixtureApi[] };
    const erreurs = corps.errors && !Array.isArray(corps.errors) ? Object.values(corps.errors) : [];
    if (erreurs.length) return { matchs: [], erreur: `API-Football : ${erreurs.join(" ")}` };
    return { matchs: (corps.response ?? []).map(normaliser), erreur: null };
  } catch (e) {
    return { matchs: [], erreur: `API-Football injoignable (${e instanceof Error ? e.message : "erreur"}).` };
  }
}

export const apiFootball: FournisseurFootball = {
  nom: "api_football",
  matchsEntre(ligue, saison, du, au) {
    return appeler(`/fixtures?league=${ligue}&season=${saison}&from=${du}&to=${au}&timezone=Africa/Kinshasa`);
  },
  matchsParIds(ids) {
    return appeler(`/fixtures?ids=${ids.slice(0, 20).join("-")}&timezone=Africa/Kinshasa`);
  },
};
