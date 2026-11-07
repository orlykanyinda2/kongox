// Mise en forme des nombres et des dates (français, heure de Kinshasa).

const nombres = new Intl.NumberFormat("fr-FR");

// 48920 → « 48 920 » (espace comme séparateur de milliers)
export function formaterNombre(n: number) {
  return nombres.format(n).replace(/ | /g, " ");
}

// 1250 → « 1 250 pièces »
export function formaterPieces(n: number) {
  return `${formaterNombre(n)} ${Math.abs(n) > 1 ? "pièces" : "pièce"}`;
}

const dates = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Kinshasa",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formaterDate(iso: string) {
  return dates.format(new Date(iso));
}

// Date du jour à Kinshasa, au format AAAA-MM-JJ
export function jourKinshasa() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kinshasa" }).format(new Date());
}

// Date et heure à Kinshasa, séparées (pour préremplir les champs date et heure d'un formulaire)
export function partiesKinshasa(iso: string) {
  const d = new Date(iso);
  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kinshasa" }).format(d);
  const heure = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Kinshasa", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { jour, heure };
}

// Numéro masqué : +243 81 ••• 42
export function masquerTelephone(tel: string | null) {
  if (!tel) return null;
  return `${tel.slice(0, 4)} ${tel.slice(4, 6)} ••• ${tel.slice(-2)}`;
}

// Heures écoulées depuis une date (arrondi vers le bas, jamais négatif)
export function heuresDepuis(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
}

// La date est-elle dans le futur ?
export function estFutur(iso: string | null | undefined) {
  return Boolean(iso && new Date(iso).getTime() > Date.now());
}

// Date ISO dans n jours
export function dansJours(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString();
}
