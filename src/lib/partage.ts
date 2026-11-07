// Liens de partage (WhatsApp, Facebook, Telegram ; TikTok par copie du lien) et adresse du site.

// Valeurs Open Graph communes (à reprendre dans le generateMetadata des pages : un openGraph de page remplace celui du site)
export const OPEN_GRAPH = { siteName: "KongoX", locale: "fr_FR", type: "website" as const };

export function urlSite() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function lienWhatsApp(texte: string) {
  return `https://wa.me/?text=${encodeURIComponent(texte)}`;
}

export function texteMarche(question: string, pourcentageOui: number, id: number) {
  return `${question} — ${pourcentageOui} % pensent OUI sur KongoX. Et toi ? ${urlSite()}/marches/${id}`;
}

// Lien WhatsApp vers l'équipe (réglage du panneau admin, sinon variable d'environnement), avec un message prêt
export function lienWhatsAppEquipe(reglage: string, texte: string) {
  const numero = (reglage || process.env.NEXT_PUBLIC_WHATSAPP_EQUIPE || "").replace(/[^0-9]/g, "");
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texte)}` : null;
}

// Liens de partage par réseau. TikTok n'a pas de lien de partage web : on copie le lien (et on propose la carte image).
export function liensPartage(url: string, texte: string) {
  const u = encodeURIComponent(url);
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${texte} ${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    telegram: `https://t.me/share/url?url=${u}&text=${encodeURIComponent(texte)}`,
  };
}
