"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export type CompteursAdmin = {
  en_attente: number;
  a_regler: number;
  cadeaux: number;
  candidatures: number;
  decisions: number;
};

const LIENS = [
  { href: "/admin", cle: "file", compteur: "file", adminSeulement: false },
  { href: "/admin/resultats", cle: "resultats", compteur: "a_regler", adminSeulement: true },
  { href: "/admin/utilisateurs", cle: "utilisateurs", compteur: null, adminSeulement: true },
  { href: "/admin/mots-de-passe", cle: "motsDePasse", compteur: null, adminSeulement: true },
  { href: "/admin/cadeaux", cle: "cadeaux", compteur: "cadeaux", adminSeulement: true },
  { href: "/admin/signalements", cle: "signalements", compteur: null, adminSeulement: true },
  { href: "/admin/curateurs", cle: "curateurs", compteur: "curateurs", adminSeulement: true },
  { href: "/admin/matchs", cle: "matchs", compteur: null, adminSeulement: true },
] as const;

// Menu du panneau admin (maquette Admin). Un curateur ne voit que la file d'approbation.
export function NavAdmin({ admin, compteurs }: { admin: boolean; compteurs: CompteursAdmin | null }) {
  const t = useTranslations("admin.menu");
  const chemin = usePathname();

  const valeur = (c: string | null) => {
    if (!compteurs || !c) return 0;
    if (c === "file") return compteurs.en_attente;
    if (c === "curateurs") return compteurs.candidatures + compteurs.decisions;
    return compteurs[c as keyof CompteursAdmin];
  };

  return (
    <nav aria-label={t("libelle")} className="flex min-w-0 flex-col gap-1 rounded-carte border-2 border-contour bg-doux p-3">
      {LIENS.filter((l) => admin || !l.adminSeulement).map((l) => {
        const actif = l.href === "/admin" ? chemin === "/admin" : chemin.startsWith(l.href);
        const n = valeur(l.compteur);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={actif ? "page" : undefined}
            className={`flex items-center justify-between rounded-bouton px-3.5 py-3 text-[15px] font-semibold ${
              actif ? "bg-foret text-white dark:bg-vert-jaune dark:text-foret" : "text-texte"
            }`}
          >
            {t(l.cle)}
            {n > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${l.compteur === "file" ? "bg-vert-jaune text-foret" : "bg-brique text-white"}`}>
                {n}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
