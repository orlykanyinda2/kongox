import { ImageResponse } from "next/og";
import { resumeProfil } from "@/lib/og/profil";
import { formaterNombre } from "@/lib/format";
import { C, Cadre, TAILLE_CARTE, chargerPolices } from "@/lib/og/carte";

// Carte image d'un profil public : nom, score Mayele, prédictions, abonnés
export const size = TAILLE_CARTE;
export const contentType = "image/png";
export const alt = "Carte KongoX : le profil d'un pronostiqueur";

export default async function Image({ params }: { params: Promise<{ nom: string }> }) {
  const { nom } = await params;
  const [p, fonts] = await Promise.all([resumeProfil(decodeURIComponent(nom).replace(/^@/, "")), chargerPolices()]);

  const chiffre = (valeur: string, libelle: string) => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 22px", borderRadius: 22, border: `3px solid ${C.foret}`, background: C.doux }}>
      <span style={{ fontFamily: "Space Grotesk", fontSize: 52 }}>{valeur}</span>
      <span style={{ fontSize: 24, color: C.secondaire }}>{libelle}</span>
    </div>
  );

  return new ImageResponse(
    p ? (
      <Cadre etiquette="Pronostiqueur">
        <div style={{ display: "flex", fontFamily: "Space Grotesk", fontSize: p.nom.length > 18 ? 64 : 80, letterSpacing: -2 }}>@{p.nom}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: 18 }}>
          <span style={{ fontFamily: "Space Grotesk", fontSize: 96, lineHeight: 0.9, color: C.hunter }}>{p.score === null ? "—" : `${p.score} %`}</span>
          <span style={{ fontSize: 32, paddingBottom: 6 }}>score Mayele</span>
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 30 }}>
          {chiffre(formaterNombre(p.predictions), "prédictions")}
          {chiffre(formaterNombre(p.reglees), "réglées")}
          {chiffre(formaterNombre(p.abonnes), "abonnés")}
        </div>
      </Cadre>
    ) : (
      <Cadre>
        <div style={{ display: "flex", fontFamily: "Space Grotesk", fontSize: 72 }}>Le Congo a un avis.</div>
      </Cadre>
    ),
    { ...TAILLE_CARTE, fonts },
  );
}
