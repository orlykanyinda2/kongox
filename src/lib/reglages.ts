import { cacheLife, cacheTag } from "next/cache";
import { creerClientPublic } from "@/lib/supabase/public";

// Réglages du jeu (table « reglages »), modifiables dans le panneau admin.
// Mis en cache ; la Server Action qui modifie un réglage appelle updateTag("reglages").

export type Reglages = Record<string, number | string>;

export const REGLAGES_PAR_DEFAUT: Reglages = {
  bonus_inscription: 1000,
  bonus_quotidien: 100,
  serie_longueur: 7,
  bonus_serie: 200,
  bonus_question_approuvee: 50,
  limite_mise_quotidienne: 2000,
  mise_minimum: 10,
  seuil_essai_curateur: 10,
  propositions_en_attente_max: 5,
  ajustement_max: 100000,
  football_saison: 2024,
  football_decalage_jours: 728,
  football_jours_a_venir: 7,
  api_football_limite_jour: 90,
  classement_min_predictions: 5,
  whatsapp_equipe: "",
};

export async function lireReglages(): Promise<Reglages> {
  "use cache";
  cacheTag("reglages");
  cacheLife("hours");
  try {
    const { data, error } = await creerClientPublic().from("reglages").select("cle, valeur, texte");
    if (error || !data) return REGLAGES_PAR_DEFAUT;
    const r: Reglages = { ...REGLAGES_PAR_DEFAUT };
    for (const l of data as { cle: string; valeur: number | null; texte: string | null }[]) r[l.cle] = l.valeur ?? l.texte ?? "";
    return r;
  } catch {
    return REGLAGES_PAR_DEFAUT;
  }
}

const nombres = new Intl.NumberFormat("fr-FR");

// Remplace les marqueurs [[cle]] des textes par la valeur du réglage (« 1 000 »)
export function appliquerReglages<T>(messages: T, reglages: Reglages): T {
  const texte = JSON.stringify(messages).replace(/\[\[([a-z_]+)\]\]/g, (tout, cle: string) => {
    const v = reglages[cle];
    if (v === undefined) return tout;
    return typeof v === "number" ? nombres.format(v).replace(/ | /g, " ") : v;
  });
  return JSON.parse(texte) as T;
}
