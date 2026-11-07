"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { chargerMarches } from "@/app/actions/fil";
import type { Marche } from "@/lib/marches/donnees";
import { CarteMarche } from "./CarteMarche";

type Props = {
  parametres: Record<string, string>; // filtres de l'URL
  dejaAffiches: number; // marchés déjà rendus par le serveur
  total: number;
  libelles: { pieces: string; partager: string; sponsorise: string; chargerPlus: string; chargement: string; fin: string; erreur: string };
};

// Chargement progressif de /marches : la page suivante arrive quand on approche du bas
// (ou avec le bouton, si le navigateur ne gère pas IntersectionObserver).
export function ChargementProgressif({ parametres, dejaAffiches, total, libelles }: Props) {
  const [marches, setMarches] = useState<Marche[]>([]);
  const [erreur, setErreur] = useState(false);
  const [enCours, demarrer] = useTransition();
  const repere = useRef<HTMLDivElement>(null);
  const affiches = dejaAffiches + marches.length;
  const reste = affiches < total;

  const charger = () => {
    if (enCours || !reste) return;
    setErreur(false);
    demarrer(async () => {
      try {
        const r = await chargerMarches(parametres, affiches);
        setMarches((avant) => {
          const vus = new Set(avant.map((m) => m.id));
          return [...avant, ...r.marches.filter((m) => !vus.has(m.id))];
        });
        if (r.marches.length === 0) setErreur(true);
      } catch {
        setErreur(true);
      }
    });
  };

  useEffect(() => {
    const el = repere.current;
    if (!el || !reste || erreur || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((e) => e[0]?.isIntersecting && charger(), { rootMargin: "600px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
    // charger dépend de affiches : on réobserve après chaque page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiches, reste, erreur]);

  return (
    <>
      {marches.length > 0 && (
        <div className="mt-[18px] grid gap-[18px] md:mt-4 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:gap-4">
          {marches.map((m, i) => (
            <CarteMarche key={m.id} marche={m} libelles={libelles} suivi={{ section: "marches", position: dejaAffiches + i + 1 }} />
          ))}
        </div>
      )}
      <div ref={repere} className="mt-8 flex justify-center" aria-live="polite">
        {reste ? (
          <button
            type="button"
            onClick={charger}
            disabled={enCours}
            className="flex h-[52px] items-center justify-center rounded-champ border-2 border-contour bg-surface px-6 text-base font-bold text-texte shadow-decale disabled:opacity-60"
          >
            {enCours ? libelles.chargement : erreur ? libelles.erreur : libelles.chargerPlus}
          </button>
        ) : (
          total > 0 && <p className="text-sm text-texte-secondaire">{libelles.fin}</p>
        )}
      </div>
    </>
  );
}
