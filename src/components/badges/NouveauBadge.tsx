"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { marquerBadgesVus } from "@/app/actions/badges";
import { BadgeIcone, type Niveau } from "./BadgeIcone";

type Badge = { code: string; nom: string; description: string; glyphe: string; niveau: Niveau };

// « Nouveau badge ! » : petite carte animée en bas de l'écran, une fois par badge gagné
export function NouveauBadge({ badges }: { badges: Badge[] }) {
  const t = useTranslations("badges");
  const [ouvert, setOuvert] = useState(true);
  if (!ouvert || badges.length === 0) return null;
  const premier = badges[0];
  const fermer = () => {
    setOuvert(false);
    void marquerBadgesVus();
  };
  return (
    <div role="status" className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-sm animate-rebond md:bottom-6">
      <div className="flex items-center gap-3.5 rounded-carte border-2 border-foret bg-vert-jaune p-4 text-foret shadow-[6px_6px_0_#1F3A26]">
        <BadgeIcone glyphe={premier.glyphe} niveau={premier.niveau} taille={56} />
        <div className="min-w-0 flex-1">
          <p className="font-titre text-lg font-bold">{t("nouveau")}</p>
          <p className="text-sm font-semibold">{premier.nom}</p>
          <p className="text-xs">{badges.length > 1 ? t("etAutres", { nombre: badges.length - 1 }) : premier.description}</p>
          <Link href="/badges" onClick={fermer} className="mt-1 inline-block text-xs font-bold underline">
            {t("voirMesBadges")}
          </Link>
        </div>
        <button type="button" onClick={fermer} aria-label={t("fermer")} className="flex size-11 flex-none items-center justify-center rounded-bouton border-2 border-foret bg-white text-lg font-bold">
          ×
        </button>
      </div>
    </div>
  );
}
