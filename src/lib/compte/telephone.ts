// Normalise un numéro de téléphone congolais vers le format +243XXXXXXXXX.
// Accepte : « +243 81 234 5678 », « 00243812345678 », « 0812345678 », « 812345678 ».
// Les numéros étrangers commençant par « + » sont gardés tels quels.
// Renvoie null si le numéro est invalide.
export function normaliserTelephone(saisie: string): string | null {
  let n = saisie.replace(/[\s.\-()]/g, "");
  if (n.startsWith("00")) n = `+${n.slice(2)}`;
  if (n.startsWith("+")) return /^\+[0-9]{8,15}$/.test(n) ? n : null;
  if (n.startsWith("0")) n = n.slice(1);
  if (/^[0-9]{9}$/.test(n)) return `+243${n}`;
  return null;
}
