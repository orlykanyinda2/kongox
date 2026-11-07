"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { suivisAyantVote } from "@/app/actions/votes";

// « 12 personnes que tu suis ont voté » sur les cartes de marché.
// Les cartes restent en cache (identiques pour tout le monde) : ce chiffre personnel arrive après,
// par une seule requête pour toutes les cartes de la page (et pour celles du chargement progressif).
export function SuivisSurCartes() {
  const [comptes, setComptes] = useState<Record<number, number>>({});
  const [cibles, setCibles] = useState<HTMLElement[]>([]);

  useEffect(() => {
    const demandes = new Set<number>();
    let minuterie: ReturnType<typeof setTimeout> | null = null;
    const scanner = () => {
      const elements = [...document.querySelectorAll<HTMLElement>("[data-suivis-marche]")];
      setCibles(elements);
      const nouveaux = elements.map((e) => Number(e.dataset.suivisMarche)).filter((id) => id > 0 && !demandes.has(id));
      if (nouveaux.length === 0) return;
      nouveaux.forEach((id) => demandes.add(id));
      suivisAyantVote(nouveaux)
        .then((r) => setComptes((avant) => ({ ...avant, ...r })))
        .catch(() => {});
    };
    scanner();
    const obs = new MutationObserver(() => {
      if (minuterie) clearTimeout(minuterie);
      minuterie = setTimeout(scanner, 300);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      if (minuterie) clearTimeout(minuterie);
    };
  }, []);

  return (
    <>
      {cibles.map((el) => {
        const n = comptes[Number(el.dataset.suivisMarche)];
        if (!n) return null;
        return createPortal(
          <span className="font-semibold text-hunter dark:text-vert-jaune">{n === 1 ? "1 personne que tu suis a voté" : `${n} personnes que tu suis ont voté`}</span>,
          el,
          el.dataset.suivisMarche,
        );
      })}
    </>
  );
}
