import Link from "next/link";
import type { ReactNode } from "react";
import { lienAvec, PAR_PAGE, type Params } from "@/lib/admin/tableau";
import { formaterNombre } from "@/lib/format";
import { Vide } from "./ui";

export type Colonne<T> = {
  cle: string;
  titre: string;
  tri?: string; // nom du tri dans l'adresse (si la colonne est triable)
  droite?: boolean; // nombres alignés à droite
  rendu: (ligne: T) => ReactNode;
};

type Props<T> = {
  chemin: string;
  params: Params;
  colonnes: Colonne<T>[];
  lignes: T[];
  cle: (ligne: T) => string | number;
  total: number;
  page: number;
  tri: string;
  croissant: boolean;
  vide: string;
};

// Tableau du back-office : tri par colonne, pagination, sans JavaScript (liens).
export function Tableau<T>({ chemin, params, colonnes, lignes, cle, total, page, tri, croissant, vide }: Props<T>) {
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const de = total === 0 ? 0 : (page - 1) * PAR_PAGE + 1;
  const a = Math.min(page * PAR_PAGE, total);

  return (
    <div className="overflow-hidden rounded-lg border border-adm-bordure bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-adm-zone text-left text-[13px]">
            <tr>
              {colonnes.map((c) => {
                const actif = c.tri === tri;
                const fleche = actif ? (croissant ? " ▲" : " ▼") : "";
                return (
                  <th
                    key={c.cle}
                    scope="col"
                    aria-sort={actif ? (croissant ? "ascending" : "descending") : undefined}
                    className={`whitespace-nowrap border-b border-adm-bordure px-3 py-2 font-semibold ${c.droite ? "text-right" : ""}`}
                  >
                    {c.tri ? (
                      <Link
                        href={lienAvec(chemin, params, { tri: c.tri, ordre: actif && !croissant ? "asc" : "desc", page: null })}
                        className="hover:underline"
                      >
                        {c.titre}
                        {fleche}
                      </Link>
                    ) : (
                      c.titre
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={cle(l)} className="border-b border-adm-bordure last:border-b-0 hover:bg-adm-zone/60">
                {colonnes.map((c) => (
                  <td key={c.cle} className={`px-3 py-2 align-top ${c.droite ? "text-right tabular-nums" : ""}`}>
                    {c.rendu(l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {lignes.length === 0 && <Vide>{vide}</Vide>}
      </div>
      <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 border-t border-adm-bordure bg-adm-zone px-3 py-2 text-[13px]">
        <span className="text-adm-secondaire">
          {formaterNombre(de)}–{formaterNombre(a)} sur {formaterNombre(total)}
        </span>
        <span className="flex gap-1.5">
          {page > 1 ? (
            <Link href={lienAvec(chemin, params, { page: String(page - 1) })} className="rounded-md border border-adm-bordure bg-white px-2.5 py-1 hover:bg-adm-zone">
              ← Précédent
            </Link>
          ) : null}
          <span className="px-1.5 py-1 text-adm-secondaire">
            Page {page} / {pages}
          </span>
          {page < pages ? (
            <Link href={lienAvec(chemin, params, { page: String(page + 1) })} className="rounded-md border border-adm-bordure bg-white px-2.5 py-1 hover:bg-adm-zone">
              Suivant →
            </Link>
          ) : null}
        </span>
      </nav>
    </div>
  );
}

// Barre de filtres (formulaire GET) + bouton d'export CSV
export function Filtres({ chemin, children, exportCsv }: { chemin: string; children: ReactNode; exportCsv?: string }) {
  return (
    <form action={chemin} method="get" className="flex flex-wrap items-end gap-2.5 rounded-lg border border-adm-bordure bg-adm-zone p-3">
      {children}
      <button type="submit" className="inline-flex h-9 items-center rounded-md bg-adm-accent px-3.5 text-sm font-semibold text-white">
        Filtrer
      </button>
      <Link href={chemin} className="inline-flex h-9 items-center rounded-md px-2 text-sm text-adm-secondaire underline">
        Réinitialiser
      </Link>
      {exportCsv && (
        <a href={exportCsv} className="ml-auto inline-flex h-9 items-center rounded-md border border-adm-bordure bg-white px-3.5 text-sm font-semibold hover:bg-adm-zone">
          Exporter en CSV
        </a>
      )}
    </form>
  );
}

export function ChampFiltre({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <label className="flex min-w-[140px] flex-col gap-1 text-[13px] font-semibold">
      {libelle}
      {children}
    </label>
  );
}
