import { ImageResponse } from "next/og";
import { C, Cadre, TAILLE_CARTE, chargerPolices } from "@/lib/og/carte";

// Carte image du site (accueil et pages sans carte propre)
export const size = TAILLE_CARTE;
export const contentType = "image/png";
export const alt = "KongoX : le Congo a un avis. Prouve-le.";

export default async function Image() {
  const fonts = await chargerPolices();
  return new ImageResponse(
    (
      <Cadre etiquette="Jeu gratuit">
        <div style={{ display: "flex", fontFamily: "Space Grotesk", fontSize: 92, lineHeight: 0.95, letterSpacing: -3 }}>Le Congo a un avis.</div>
        <div style={{ display: "flex", marginTop: 22 }}>
          <span
            style={{
              display: "flex",
              fontFamily: "Space Grotesk",
              fontSize: 80,
              padding: "0 28px 10px",
              borderRadius: 30,
              border: `4px solid ${C.foret}`,
              background: C.vertJaune,
              boxShadow: `8px 8px 0 ${C.foret}`,
            }}
          >
            Prouve-le.
          </span>
        </div>
        <div style={{ display: "flex", marginTop: 34, fontSize: 30, color: C.secondaire }}>Foot, musique, politique, vie quotidienne : prédis avec tes pièces gratuites.</div>
      </Cadre>
    ),
    { ...TAILLE_CARTE, fonts },
  );
}
