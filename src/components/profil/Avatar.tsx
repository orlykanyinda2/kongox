// Image de profil : la photo perso si elle existe, sinon l'icône KongoX (public/avatars).
// Les icônes élite ont un cadre spécial (double anneau vert-jaune et or). Composant sans état :
// utilisable côté serveur et dans les composants navigateur.

export type DonneesAvatar = { nom: string | null; icone: string | null; photo: string | null; elite?: boolean };

const URL_STOCKAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/avatars/`;

export function urlAvatar(icone: string | null, photo: string | null) {
  if (photo) return URL_STOCKAGE + photo;
  return `/avatars/${icone ?? "masque_rond"}.svg`;
}

export function Avatar({ nom, icone, photo, elite = false, taille = 40, className = "" }: DonneesAvatar & { taille?: number; className?: string }) {
  const cadre = elite ? "ring-[3px] ring-[#E9C46A] ring-offset-2 ring-offset-vert-jaune" : "border-2 border-contour";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- petites images déjà légères (SVG ou photo de 500 Ko max.)
    <img
      src={urlAvatar(icone, photo)}
      alt={nom ? `Image de profil de @${nom}` : "Image de profil"}
      width={taille}
      height={taille}
      loading="lazy"
      decoding="async"
      className={`flex-none rounded-full bg-doux object-cover ${cadre} ${className}`}
      style={{ width: taille, height: taille }}
    />
  );
}
