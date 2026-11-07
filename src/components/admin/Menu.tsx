"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type Compteurs = Partial<Record<"approbation" | "resultats" | "cadeaux" | "curateurs" | "programmation", number>>;

const LIENS = [
  { href: "/admin", libelle: "Tableau de bord", admin: true },
  { href: "/admin/marches", libelle: "Marchés", admin: true },
  { href: "/admin/programmation", libelle: "Programmation", admin: true, compteur: "programmation" },
  { href: "/admin/approbation", libelle: "File d'approbation", admin: false, compteur: "approbation" },
  { href: "/admin/resultats", libelle: "Résultats à régler", admin: true, compteur: "resultats", alerte: true },
  { href: "/admin/utilisateurs", libelle: "Utilisateurs", admin: true },
  { href: "/admin/matchs", libelle: "Matchs", admin: true },
  { href: "/admin/pieces", libelle: "Pièces", admin: true },
  { href: "/admin/cadeaux", libelle: "Cadeaux", admin: true, compteur: "cadeaux" },
  { href: "/admin/curateurs", libelle: "Curateurs", admin: true, compteur: "curateurs" },
  { href: "/admin/communautes", libelle: "Communautés", admin: true },
  { href: "/admin/signalements", libelle: "Signalements", admin: true },
  { href: "/admin/journal", libelle: "Journal", admin: true },
  { href: "/admin/reglages", libelle: "Réglages", admin: true },
] as const;

type Props = { admin: boolean; compteurs: Compteurs };

// Menu latéral du back-office. Un curateur ne voit que la file d'approbation.
export function Menu(props: Props) {
  return (
    <Suspense fallback={<Liens {...props} chemin={null} />}>
      <MenuAvecChemin {...props} />
    </Suspense>
  );
}

function MenuAvecChemin(props: Props) {
  return <Liens {...props} chemin={usePathname()} />;
}

function Liens({ admin, compteurs, chemin }: Props & { chemin: string | null }) {
  return (
    <nav aria-label="Menu admin">
      <ul className="flex flex-col gap-0.5">
        {LIENS.filter((l) => admin || !l.admin).map((l) => {
          const actif = chemin !== null && (l.href === "/admin" ? chemin === "/admin" : chemin.startsWith(l.href));
          const n = "compteur" in l ? (compteurs[l.compteur] ?? 0) : 0;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={actif ? "page" : undefined}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                  actif ? "bg-adm-accent font-semibold text-white" : "text-adm-texte hover:bg-white"
                }`}
              >
                {l.libelle}
                {n > 0 && (
                  <span
                    className={`min-w-5 rounded px-1.5 text-center text-xs font-semibold tabular-nums ${
                      actif ? "bg-white/20 text-white" : "alerte" in l && l.alerte ? "bg-adm-danger text-white" : "bg-adm-bordure text-adm-texte"
                    }`}
                  >
                    {n}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
