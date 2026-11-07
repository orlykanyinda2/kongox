// Format commun des matchs, quel que soit le fournisseur (API-Football aujourd'hui).
// La fonction SQL enregistrer_matchs() reçoit exactement ce format.

export type EquipeNormalisee = { id_externe: number; nom: string; logo_url: string | null };

export type MatchNormalise = {
  id_externe: number;
  ligue_externe: number;
  saison: number;
  journee: string | null;
  date_api: string; // ISO, date réelle du coup d'envoi
  statut_api: string; // NS, 1H, HT, 2H, FT, AET, PEN, PST, CANC, ABD, AWD, WO…
  buts_dom: number | null; // score à 90 minutes
  buts_ext: number | null;
  dom: EquipeNormalisee;
  ext: EquipeNormalisee;
};

export type ReponseFournisseur = { matchs: MatchNormalise[]; erreur: string | null };

export interface FournisseurFootball {
  nom: string; // identifiant enregistré dans la base (colonne fournisseur)
  // Matchs d'une ligue entre deux dates (AAAA-MM-JJ, heure de Kinshasa)
  matchsEntre(ligueExterne: number, saison: number, du: string, au: string): Promise<ReponseFournisseur>;
  // Matchs par identifiants (20 au maximum par appel)
  matchsParIds(ids: number[]): Promise<ReponseFournisseur>;
}
