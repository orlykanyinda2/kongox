// Liens de partage. Le partage complet (Facebook, TikTok, Telegram, cartes image) arrive à l'étape 6.

export function urlSite() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function lienWhatsApp(texte: string) {
  return `https://wa.me/?text=${encodeURIComponent(texte)}`;
}

export function texteMarche(question: string, pourcentageOui: number, id: number) {
  return `${question} — ${pourcentageOui} % pensent OUI sur KongoX. Et toi ? ${urlSite()}/marches/${id}`;
}
