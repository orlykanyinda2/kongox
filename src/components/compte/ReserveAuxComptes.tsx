import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { lireReglages } from "@/lib/reglages";

export type Fonction = "bonus" | "assistant" | "commentaires" | "proposer" | "suivre" | "communautes" | "cadeaux" | "icones";

// Ce que l'invité rate, avec le bouton « Crée ton compte » (le compte garde ses votes et ses pièces)
export async function ReserveAuxComptes({ fonction, sombre = false, compact = false }: { fonction: Fonction; sombre?: boolean; compact?: boolean }) {
  const t = await getTranslations("invite");
  const r = await lireReglages();
  const texte = t(`reserve_${fonction}`, { pieces: Number(r.bonus_quotidien ?? 100) });
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-champ border-2 ${compact ? "px-3.5 py-3" : "p-4"} ${
        sombre ? "border-vert-jaune bg-foret text-white" : "border-foret bg-champagne text-foret"
      }`}
    >
      <p className="min-w-0 flex-1 text-[15px] font-semibold">{texte}</p>
      <Link href="/inscription" className="flex h-11 flex-none items-center rounded-bouton bg-vert-jaune px-4 text-[15px] font-bold text-foret">
        {t("creerMonCompte")}
      </Link>
    </div>
  );
}
