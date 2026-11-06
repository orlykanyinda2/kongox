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
