import type { MetadataRoute } from "next";

// Manifeste de la PWA : permet d'installer KongoX sur l'écran d'accueil du téléphone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KongoX — Reality. Probability. Insight.",
    short_name: "KongoX",
    description: "Le marché des prédictions du Congo, avec des pièces gratuites. Jamais d'argent réel.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#1F3A26",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/icone-masquable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
