"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconeBallon, IconeBulle, IconeMaison, IconePlus, IconeTrophee } from "@/components/icones";

// Barre du bas sur mobile (maquette Mobile) : Accueil, Foot, « + », Classement, Chat.
// L'adresse de la page n'est connue qu'au moment de la visite : la barre s'affiche d'abord
// sans lien actif (Suspense), puis le lien de la page courante s'allume.
export function BarreNavigation() {
  return (
    <Suspense fallback={<Barre chemin={null} />}>
      <BarreAvecChemin />
    </Suspense>
  );
}

function BarreAvecChemin() {
  return <Barre chemin={usePathname()} />;
}

function Barre({ chemin }: { chemin: string | null }) {
  const t = useTranslations("navigation");

  const lien = (href: string, libelle: string, icone: React.ReactNode) => {
    const actif = chemin !== null && (href === "/" ? chemin === "/" : chemin.startsWith(href));
    return (
      <Link
        href={href}
        aria-current={actif ? "page" : undefined}
        className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] ${
          actif ? "font-bold text-hunter dark:text-vert-jaune" : "font-semibold text-texte-secondaire"
        }`}
      >
        {icone}
        {libelle}
      </Link>
    );
  };

  return (
    <nav
      aria-label={t("libelle")}
      className="fixed inset-x-0 bottom-0 z-20 grid h-[76px] grid-cols-5 items-center border-t-2 border-contour bg-entete pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {lien("/", t("accueil"), <IconeMaison />)}
      {lien("/football", t("foot"), <IconeBallon />)}
      <Link href="/proposer" aria-label={t("proposer")} className="flex justify-center">
        <span className="flex size-[52px] items-center justify-center rounded-2xl border-2 border-foret bg-vert-jaune text-foret">
          <IconePlus taille={24} epaisseur={3} />
        </span>
      </Link>
      {lien("/classement", t("classement"), <IconeTrophee />)}
      {lien("/chat", t("chat"), <IconeBulle />)}
    </nav>
  );
}
