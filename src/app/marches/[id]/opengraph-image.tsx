import { ImageResponse } from "next/og";
import { obtenirMarche } from "@/lib/marches/donnees";
import { matchDuMarche } from "@/lib/football/donnees";
import { LIBELLES_CATEGORIES } from "@/lib/marches/categories";
import { formaterNombre } from "@/lib/format";
import { Barre, C, Cadre, TAILLE_CARTE, chargerPolices, tailleTitre } from "@/lib/og/carte";

// Carte image d'un marché (aperçu WhatsApp, Facebook, Telegram ; « Télécharger la carte »)
export const size = TAILLE_CARTE;
export const contentType = "image/png";
export const alt = "Carte KongoX : la question et ce que pense la communauté";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numero = Number(id);
  const [marche, match, fonts] = await Promise.all([
    Number.isInteger(numero) && numero > 0 ? obtenirMarche(numero) : Promise.resolve(null),
    Number.isInteger(numero) && numero > 0 ? matchDuMarche(numero) : Promise.resolve(null),
    chargerPolices(),
  ]);
  const visible = marche && ["approuve", "ferme", "regle"].includes(marche.statut);

  let contenu;
  if (!marche || !visible) {
    contenu = (
      <Cadre>
        <div style={{ display: "flex", fontFamily: "Space Grotesk", fontSize: 72, lineHeight: 1 }}>Le Congo a un avis.</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 34, color: C.secondaire }}>Foot, musique, politique, vie quotidienne : prédis avec tes pièces gratuites.</div>
      </Cadre>
    );
  } else if (match) {
    const titre = `${match.dom} – ${match.ext}`;
    const choix = [`1 · ${match.dom}`, "N · Nul", `2 · ${match.ext}`];
    const fonds = [C.vertJaune, C.champagne, C.brique];
    contenu = (
      <Cadre etiquette={match.ligue.nom}>
        <div style={{ display: "flex", fontFamily: "Space Grotesk", fontSize: tailleTitre(titre), lineHeight: 1.05, letterSpacing: -1.5 }}>{titre}</div>
        <div style={{ display: "flex", gap: 18, marginTop: 34 }}>
          {match.pourcentages.map((p, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "18px 22px",
                borderRadius: 22,
                border: `3px solid ${C.foret}`,
                background: fonds[i],
                color: i === 2 ? "#FFFFFF" : C.foret,
              }}
            >
              <span style={{ fontFamily: "Space Grotesk", fontSize: 56 }}>{p} %</span>
              <span style={{ fontSize: 24 }}>{choix[i].length > 26 ? `${choix[i].slice(0, 25)}…` : choix[i]}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 22, fontSize: 26, color: C.secondaire }}>
          {formaterNombre(match.volume)} pièces misées · 1, N ou 2 ?
        </div>
      </Cadre>
    );
  } else {
    const pct = marche.pourcentageOui;
    contenu = (
      <Cadre etiquette={LIBELLES_CATEGORIES[marche.categorie]}>
        <div style={{ display: "flex", fontFamily: "Space Grotesk", fontSize: tailleTitre(marche.question), lineHeight: 1.08, letterSpacing: -1 }}>{marche.question}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginTop: 30 }}>
          <span style={{ fontFamily: "Space Grotesk", fontSize: 96, lineHeight: 0.9, color: C.hunter }}>{pct} %</span>
          <span style={{ fontSize: 32, paddingBottom: 6 }}>pensent OUI</span>
          <span style={{ marginLeft: "auto", fontSize: 26, color: C.secondaire, paddingBottom: 8 }}>{formaterNombre(marche.volume)} pièces misées</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 18 }}>
          <Barre pourcentage={pct} />
        </div>
        {marche.sponsor && <div style={{ display: "flex", marginTop: 14, fontSize: 22, color: C.secondaire }}>Question offerte par {marche.sponsor}</div>}
      </Cadre>
    );
  }

  return new ImageResponse(contenu, { ...TAILLE_CARTE, fonts });
}
