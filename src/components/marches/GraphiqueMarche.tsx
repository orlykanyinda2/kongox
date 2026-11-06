"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PointHistorique } from "@/lib/marches/donnees";

type Periode = "24h" | "14j" | "tout";
const DUREES: Record<Periode, number | null> = { "24h": 86_400_000, "14j": 14 * 86_400_000, tout: null };
const L = 354;
const H = 120;

// Graphique d'évolution du OUI (maquette Marche) : ligne verte, point rouge qui pulse au bout.
export function GraphiqueMarche({ historique, pourcentage }: { historique: PointHistorique[]; pourcentage: number }) {
  const t = useTranslations("marche");
  const [periode, setPeriode] = useState<Periode>("14j");
  // Calculé une seule fois à l'affichage : les périodes sont relatives à ce moment
  const [maintenant] = useState(() => Date.now());

  const duree = DUREES[periode];
  const depuis = duree === null ? 0 : maintenant - duree;
  const avant = [...historique].reverse().find((p) => new Date(p.moment).getTime() < depuis);
  const dans = historique.filter((p) => new Date(p.moment).getTime() >= depuis).map((p) => p.pourcentage);

  // Point de départ de la période (dernière valeur connue avant, sinon 50 %) puis valeur actuelle
  const valeurs = [avant?.pourcentage ?? (dans.length ? dans[0] : pourcentage), ...dans, pourcentage];
  const ecart = Math.round(pourcentage - valeurs[0]);
  const points = valeurs.map((v, i) => [Math.round((i / (valeurs.length - 1)) * L), Math.round(H - 10 - (v / 100) * (H - 20))]);
  const dernier = points[points.length - 1];

  const libellePeriode = { "24h": t("periode24h"), "14j": t("periode14j"), tout: t("periodeTout") }[periode];

  return (
    <section aria-label={t("evolution")} className="rounded-[18px] border-2 border-contour bg-surface p-4 shadow-decale md:p-6 md:shadow-decale-md">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-titre text-[40px] font-bold text-hunter md:text-[56px] dark:text-vert-jaune">{pourcentage} %</span>
          <span className="ml-1.5 text-sm text-texte-secondaire">OUI</span>
        </div>
        <span className="text-[13px] font-bold text-hunter dark:text-vert-jaune">
          {t("ecart", { ecart: ecart > 0 ? `+${ecart}` : String(ecart), periode: libellePeriode })}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${L} ${H}`}
        className="mt-2 block h-auto w-full"
        role="img"
        aria-label={t("graphiqueLibelle", { debut: Math.round(valeurs[0]), fin: pourcentage, periode: libellePeriode })}
      >
        {[30, 60, 90].map((y) => (
          <line key={y} x1="0" y1={y} x2={L} y2={y} className="stroke-doux" strokeWidth="1" />
        ))}
        <polyline
          points={points.map((p) => p.join(",")).join(" ")}
          fill="none"
          className="stroke-hunter dark:stroke-vert-jaune"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={dernier[0] - 6} cy={dernier[1]} r="6" fill="#BC4749" className="animate-pulse-direct" />
      </svg>
      <div className="mt-1.5 flex gap-1.5" role="group" aria-label={t("choisirPeriode")}>
        {(Object.keys(DUREES) as Periode[]).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === periode}
            onClick={() => setPeriode(p)}
            className={`h-11 rounded-[10px] px-3 text-[13px] font-semibold ${p === periode ? "bg-foret text-white dark:bg-vert-jaune dark:text-foret" : "bg-doux text-texte"}`}
          >
            {{ "24h": t("bouton24h"), "14j": t("bouton14j"), tout: t("boutonTout") }[p]}
          </button>
        ))}
      </div>
    </section>
  );
}
