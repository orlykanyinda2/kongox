"use client";

import { useState } from "react";

type Point = { jour: string; valeur: number };

const L = 320;
const H = 120;
const MARGE = { haut: 10, bas: 22, gauche: 36, droite: 10 };

const formatNombre = new Intl.NumberFormat("fr-FR");
const nombre = (n: number) => formatNombre.format(n).replace(/ | /g, " ");
const compact = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)} k` : nombre(n));
const formatJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const jourCourt = (iso: string) => formatJour.format(new Date(`${iso}T00:00:00Z`));

// Graude ronde au-dessus du maximum (0 / 5 / 10 / 20 / 50…)
function maximumRond(max: number) {
  if (max <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

// Une série par graphique (DESIGN.md « Panneau admin ») : ligne 2 px, grille fine,
// info-bulle au survol (et au clavier), valeur du dernier jour affichée au bout.
export function GraphiqueSerie({ titre, points, unite }: { titre: string; points: Point[]; unite?: string }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const max = maximumRond(Math.max(0, ...points.map((p) => p.valeur)));
  const largeur = L - MARGE.gauche - MARGE.droite;
  const hauteur = H - MARGE.haut - MARGE.bas;
  const x = (i: number) => MARGE.gauche + (points.length <= 1 ? largeur / 2 : (i / (points.length - 1)) * largeur);
  const y = (v: number) => MARGE.haut + hauteur - (v / max) * hauteur;
  const trace = points.map((p, i) => `${x(i).toFixed(1)},${y(p.valeur).toFixed(1)}`).join(" ");
  const dernier = points[points.length - 1];
  const actif = survol !== null ? points[survol] : null;
  const total = points.reduce((s, p) => s + p.valeur, 0);

  function choisir(clientX: number, rect: DOMRect) {
    const rel = ((clientX - rect.left) / rect.width) * L;
    const i = Math.round(((rel - MARGE.gauche) / largeur) * (points.length - 1));
    setSurvol(Math.min(points.length - 1, Math.max(0, i)));
  }

  return (
    <figure className="rounded-lg border border-adm-bordure bg-white p-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">{titre}</span>
        <span className="text-xs text-adm-secondaire">
          Total : <strong className="text-adm-texte tabular-nums">{nombre(total)}</strong>
          {unite ? ` ${unite}` : ""}
        </span>
      </figcaption>
      <div className="relative mt-1">
        <svg
          viewBox={`0 0 ${L} ${H}`}
          className="block h-auto w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-adm-accent/40"
          role="img"
          aria-label={`${titre} : ${points.length} jours, dernier jour ${nombre(dernier?.valeur ?? 0)}`}
          tabIndex={0}
          onPointerMove={(e) => choisir(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setSurvol(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setSurvol((s) => Math.min(points.length - 1, (s ?? -1) + 1));
            if (e.key === "ArrowLeft") setSurvol((s) => Math.max(0, (s ?? points.length) - 1));
          }}
          onBlur={() => setSurvol(null)}
        >
          {[0, max / 2, max].map((v) => (
            <g key={v}>
              <line x1={MARGE.gauche} x2={L - MARGE.droite} y1={y(v)} y2={y(v)} stroke="#E3E7DF" strokeWidth="1" />
              <text x={MARGE.gauche - 5} y={y(v) + 3.5} textAnchor="end" fontSize="9" fill="#5B6B57">
                {compact(v)}
              </text>
            </g>
          ))}
          {points.length > 0 && (
            <>
              <text x={MARGE.gauche} y={H - 6} fontSize="9" fill="#5B6B57">
                {jourCourt(points[0].jour)}
              </text>
              <text x={L - MARGE.droite} y={H - 6} fontSize="9" fill="#5B6B57" textAnchor="end">
                {jourCourt(dernier.jour)}
              </text>
            </>
          )}
          <polyline points={trace} fill="none" stroke="#6A994E" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {dernier && <circle cx={x(points.length - 1)} cy={y(dernier.valeur)} r="4" fill="#6A994E" stroke="#fff" strokeWidth="2" />}
          {actif && survol !== null && (
            <>
              <line x1={x(survol)} x2={x(survol)} y1={MARGE.haut} y2={MARGE.haut + hauteur} stroke="#5B6B57" strokeWidth="1" />
              <circle cx={x(survol)} cy={y(actif.valeur)} r="4.5" fill="#6A994E" stroke="#fff" strokeWidth="2" />
            </>
          )}
        </svg>
        {actif && survol !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-md border border-adm-bordure bg-white px-2 py-1 text-xs shadow-sm"
            style={{ left: `${(x(survol) / L) * 100}%` }}
          >
            <span className="text-adm-secondaire">{jourCourt(actif.jour)} · </span>
            <strong className="tabular-nums">{nombre(actif.valeur)}</strong>
          </div>
        )}
      </div>
    </figure>
  );
}
