import Link from "next/link";
import type { ReactNode } from "react";

// Briques du back-office (style sobre : DESIGN.md « Panneau admin »).

export const cls = {
  principal: "inline-flex h-9 items-center justify-center rounded-md bg-adm-accent px-3.5 text-sm font-semibold text-white hover:bg-[#2d5434] disabled:opacity-50",
  secondaire:
    "inline-flex h-9 items-center justify-center rounded-md border border-adm-bordure bg-white px-3.5 text-sm font-semibold text-adm-texte hover:bg-adm-zone disabled:opacity-50",
  danger: "inline-flex h-9 items-center justify-center rounded-md bg-adm-danger px-3.5 text-sm font-semibold text-white hover:bg-[#a33d3f] disabled:opacity-50",
  dangerContour:
    "inline-flex h-9 items-center justify-center rounded-md border border-adm-danger bg-white px-3.5 text-sm font-semibold text-adm-danger hover:bg-[#fbeeee] disabled:opacity-50",
  champ:
    "h-9 w-full rounded-md border border-adm-bordure bg-white px-2.5 text-sm text-adm-texte outline-none focus:border-adm-accent focus:ring-2 focus:ring-adm-accent/20",
  zoneTexte:
    "w-full rounded-md border border-adm-bordure bg-white px-2.5 py-2 text-sm text-adm-texte outline-none focus:border-adm-accent focus:ring-2 focus:ring-adm-accent/20",
  label: "block text-[13px] font-semibold text-adm-texte",
  aide: "mt-1 text-xs text-adm-secondaire",
  carte: "rounded-lg border border-adm-bordure bg-white",
};

export function EnTetePage({ titre, description, actions }: { titre: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-adm-bordure pb-4">
      <div>
        <h1 className="font-sans text-[21px] font-semibold leading-tight tracking-normal">{titre}</h1>
        {description && <p className="mt-1 text-sm text-adm-secondaire">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ titre, actions, children, className = "" }: { titre?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`${cls.carte} ${className}`}>
      {(titre || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-adm-bordure px-4 py-2.5">
          {titre && <h2 className="font-sans text-[15px] font-semibold tracking-normal">{titre}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Chiffre({ valeur, libelle, lien, alerte = false }: { valeur: string; libelle: string; lien?: string; alerte?: boolean }) {
  const contenu = (
    <>
      <div className={`text-2xl font-semibold tabular-nums ${alerte ? "text-adm-danger" : ""}`}>{valeur}</div>
      <div className="mt-0.5 text-[13px] text-adm-secondaire">{libelle}</div>
    </>
  );
  return lien ? (
    <Link href={lien} className={`${cls.carte} block p-4 hover:border-adm-accent`}>
      {contenu}
    </Link>
  ) : (
    <div className={`${cls.carte} p-4`}>{contenu}</div>
  );
}

const STYLES_STATUT: Record<string, string> = {
  neutre: "bg-adm-zone text-adm-texte border-adm-bordure",
  accent: "bg-[#e8f0e4] text-adm-accent border-[#cfe0c8]",
  danger: "bg-[#fbeeee] text-adm-danger border-[#f0d3d3]",
  attention: "bg-[#fbf4e4] text-[#7a5a12] border-[#eedfb8]",
};

export function Pastille({ children, ton = "neutre" }: { children: ReactNode; ton?: keyof typeof STYLES_STATUT }) {
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${STYLES_STATUT[ton]}`}>{children}</span>;
}

// Statut d'un marché, avec le libellé du back-office (« approuve » s'affiche « En ligne »)
export const STATUTS_MARCHE: Record<string, { libelle: string; ton: keyof typeof STYLES_STATUT }> = {
  brouillon: { libelle: "Brouillon", ton: "neutre" },
  programme: { libelle: "Programmé", ton: "attention" },
  en_attente: { libelle: "En attente", ton: "attention" },
  approuve: { libelle: "En ligne", ton: "accent" },
  refuse: { libelle: "Refusé", ton: "danger" },
  ferme: { libelle: "Fermé", ton: "neutre" },
  regle: { libelle: "Réglé", ton: "neutre" },
  supprime: { libelle: "Supprimé", ton: "danger" },
};

export function StatutMarche({ statut }: { statut: string }) {
  const s = STATUTS_MARCHE[statut] ?? { libelle: statut, ton: "neutre" as const };
  return <Pastille ton={s.ton}>{s.libelle}</Pastille>;
}

export function Vide({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-adm-secondaire">{children}</p>;
}
