"use client";

import { useEffect } from "react";

// Mesure du fil (docs/ALGORITHME.md, « Mesure ») : affichages, clics et prédictions.
// - Aucune donnée personnelle : un identifiant aléatoire par navigateur (visiteur) et par onglet (visite).
// - Ne ralentit pas la page : les événements sont groupés et envoyés en arrière-plan (sendBeacon).
// Une carte suivie porte data-fil-marche, data-fil-section et data-fil-position.

type Evenement = { type: "affiche" | "clic" | "prediction" | "visite"; marche_id?: number; section?: string; position?: number; page: string };

const URL_ENVOI = "/api/evenements";
const file: Evenement[] = [];
let minuterie: ReturnType<typeof setTimeout> | null = null;

function aleatoire() {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  // Navigateurs anciens (ou page sans HTTPS) : UUID v4 à partir de getRandomValues
  const o = c.getRandomValues(new Uint8Array(16));
  o[6] = (o[6] & 0x0f) | 0x40;
  o[8] = (o[8] & 0x3f) | 0x80;
  const h = [...o].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function identifiant(stockage: Storage, cle: string) {
  try {
    let id = stockage.getItem(cle);
    if (!id) {
      id = aleatoire();
      stockage.setItem(cle, id);
    }
    return id;
  } catch {
    return aleatoire(); // navigation privée stricte : identifiant de la page seulement
  }
}

function envoyer() {
  if (minuterie) clearTimeout(minuterie);
  minuterie = null;
  if (file.length === 0) return;
  const lot = file.splice(0, 50);
  const corps = JSON.stringify({
    visiteur_id: identifiant(localStorage, "kx_visiteur"),
    visite_id: identifiant(sessionStorage, "kx_visite"),
    evenements: lot,
  });
  const blob = new Blob([corps], { type: "application/json" });
  if (!navigator.sendBeacon?.(URL_ENVOI, blob)) {
    fetch(URL_ENVOI, { method: "POST", body: blob, keepalive: true }).catch(() => {});
  }
  if (file.length) envoyer();
}

function ajouter(e: Omit<Evenement, "page">) {
  file.push({ ...e, page: location.pathname.slice(0, 40) });
  if (file.length >= 30) envoyer();
  else minuterie ??= setTimeout(envoyer, 5000);
}

function lireCarte(el: Element) {
  const h = el as HTMLElement;
  const marche_id = Number(h.dataset.filMarche);
  const position = Number(h.dataset.filPosition);
  return { marche_id, section: h.dataset.filSection || undefined, position: Number.isFinite(position) ? position : undefined };
}

// À appeler après une prédiction réussie : retrouve la section d'où venait le clic
export function signalerPrediction(marcheId: number) {
  let origine: { section?: string; position?: number } = {};
  try {
    origine = JSON.parse(sessionStorage.getItem(`kx_origine_${marcheId}`) ?? "{}");
  } catch {}
  ajouter({ type: "prediction", marche_id: marcheId, ...origine });
  envoyer();
}

// Monté une seule fois dans la mise en page
export function SuiviFil() {
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return; // le back-office n'est pas mesuré
    // Une « visite » par onglet
    try {
      if (!sessionStorage.getItem("kx_visite_comptee")) {
        sessionStorage.setItem("kx_visite_comptee", "1");
        ajouter({ type: "visite" });
      }
    } catch {}

    // Affichage : carte visible à moitié, comptée une fois par page
    const vus = new WeakSet<Element>();
    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          if (!e.isIntersecting || vus.has(e.target)) continue;
          vus.add(e.target);
          observateur.unobserve(e.target);
          ajouter({ type: "affiche", ...lireCarte(e.target) });
        }
      },
      { threshold: 0.5 },
    );
    const observerTout = () => document.querySelectorAll("[data-fil-marche]").forEach((el) => vus.has(el) || observateur.observe(el));
    observerTout();
    // Nouvelles cartes (chargement progressif, navigation entre pages)
    const mutations = new MutationObserver(() => observerTout());
    mutations.observe(document.body, { childList: true, subtree: true });

    // Clic sur une carte (n'importe où dedans)
    const surClic = (ev: MouseEvent) => {
      const carte = (ev.target as Element | null)?.closest?.("[data-fil-marche]");
      if (!carte) return;
      const c = lireCarte(carte);
      try {
        sessionStorage.setItem(`kx_origine_${c.marche_id}`, JSON.stringify({ section: c.section, position: c.position }));
      } catch {}
      ajouter({ type: "clic", ...c });
    };
    document.addEventListener("click", surClic, { capture: true });

    const surMasque = () => document.visibilityState === "hidden" && envoyer();
    document.addEventListener("visibilitychange", surMasque);

    return () => {
      observateur.disconnect();
      mutations.disconnect();
      document.removeEventListener("click", surClic, { capture: true });
      document.removeEventListener("visibilitychange", surMasque);
      envoyer();
    };
  }, []);
  return null;
}
