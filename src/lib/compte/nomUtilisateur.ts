// Règles du nom d'utilisateur et adresse cachée de Supabase Auth.
// Ce fichier est partagé entre le navigateur et le serveur.

// 3 à 24 caractères : lettres sans accent, chiffres et « _ ». Même règle que la base de données.
export const FORMAT_NOM = /^[A-Za-z0-9_]{3,24}$/;

export const MDP_LONGUEUR_MIN = 6;
export const MDP_LONGUEUR_MAX = 72;

// Domaine de l'adresse cachée. Elle n'est JAMAIS affichée à l'utilisateur.
const DOMAINE_CACHE = "kongox.local";

export function nomValide(nom: string) {
  return FORMAT_NOM.test(nom);
}

export function emailCache(nom: string) {
  return `${nom.toLowerCase()}@${DOMAINE_CACHE}`;
}
