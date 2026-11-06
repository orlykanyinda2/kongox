// Suggestions de noms drôles pour l'inscription.
// D'abord les noms de la maquette, puis des combinaisons au hasard.

const NOMS_FIXES = [
  "Mayele_ya_Matonge",
  "Prono_King243",
  "Leopard_Fidele",
  "Kin_la_Belle",
  "Soki_Master",
  "Mwana_Lobi",
  "Rumba_Prono",
  "Tala_Tala_99",
];

const DEBUTS = ["Mayele", "Prono", "Leopard", "Soki", "Mwana", "Rumba", "Ndeko", "Mokonzi", "Zoba_Te", "Sapeur", "Mboka", "Elanga"];
const FINS = ["ya_Matonge", "ya_Limete", "ya_Bandal", "ya_Lemba", "ya_Gombe", "King", "Master", "Fidele", "243", "Kin", "Lushi", "Goma"];

export function nomDrole(index: number): string {
  if (index < NOMS_FIXES.length) return NOMS_FIXES[index];
  const debut = DEBUTS[Math.floor(Math.random() * DEBUTS.length)];
  const fin = FINS[Math.floor(Math.random() * FINS.length)];
  const nombre = Math.random() < 0.5 ? String(Math.floor(Math.random() * 90) + 10) : "";
  return `${debut}_${fin}${nombre}`.slice(0, 24);
}
