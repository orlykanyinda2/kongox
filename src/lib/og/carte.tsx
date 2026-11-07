import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";

// Cartes image de partage (Open Graph, 1200 × 630), dessinées par next/og.
// Couleurs de DESIGN.md : fond blanc, contour vert forêt, vert-jaune, brique.

export const TAILLE_CARTE = { width: 1200, height: 630 };

export const C = {
  foret: "#1F3A26",
  hunter: "#386641",
  sauge: "#6A994E",
  vertJaune: "#A7C957",
  brique: "#BC4749",
  champagne: "#F2E8CF",
  doux: "#F1F5E8",
  secondaire: "#4B5A44",
};

let polices: Promise<{ name: string; data: Buffer; weight: 600 | 700; style: "normal" }[]> | null = null;

// Polices lues une seule fois par serveur (src/assets/polices, licence OFL)
export function chargerPolices() {
  polices ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/polices/SpaceGrotesk-Bold.ttf")),
    readFile(join(process.cwd(), "src/assets/polices/Inter-SemiBold.ttf")),
  ]).then(([titre, texte]) => [
    { name: "Space Grotesk", data: titre, weight: 700 as const, style: "normal" as const },
    { name: "Inter", data: texte, weight: 600 as const, style: "normal" as const },
  ]);
  return polices;
}

// Taille du titre selon sa longueur (les questions vont jusqu'à 200 caractères)
export function tailleTitre(texte: string) {
  const n = texte.length;
  return n <= 50 ? 68 : n <= 90 ? 56 : n <= 130 ? 46 : 38;
}

// Cadre commun : logo en haut, mention « Jamais d'argent réel » en bas
export function Cadre({ children, etiquette }: { children: ReactNode; etiquette?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: C.vertJaune, padding: 28, fontFamily: "Inter" }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "#FFFFFF",
          border: `4px solid ${C.foret}`,
          borderRadius: 36,
          padding: "40px 52px",
          color: C.foret,
          boxShadow: `12px 12px 0 ${C.foret}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: C.vertJaune,
                border: `3px solid ${C.foret}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Space Grotesk",
                fontSize: 34,
              }}
            >
              X
            </div>
            <div style={{ display: "flex", fontFamily: "Space Grotesk", fontSize: 40, letterSpacing: -1 }}>
              Kongo
              <span style={{ marginLeft: 4, padding: "0 10px", borderRadius: 10, background: C.vertJaune }}>X</span>
            </div>
          </div>
          {etiquette && (
            <div style={{ display: "flex", padding: "8px 18px", borderRadius: 999, border: `3px solid ${C.foret}`, fontSize: 24 }}>{etiquette}</div>
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: C.secondaire }}>
          <span>Jamais d&apos;argent réel · pièces gratuites</span>
          <span style={{ color: C.foret }}>Et toi ? Donne ton avis sur KongoX</span>
        </div>
      </div>
    </div>
  );
}

// Barre OUI (vert-jaune) sur fond NON (brique), comme dans l'application
export function Barre({ pourcentage }: { pourcentage: number }) {
  return (
    <div style={{ display: "flex", height: 34, borderRadius: 999, border: `3px solid ${C.foret}`, background: C.brique, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pourcentage))}%`, background: C.vertJaune }} />
    </div>
  );
}
