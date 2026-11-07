// Offres de la page « Devenir partenaire de KongoX » (maquettes/Partenaires.dc.html)

export const TYPES_PARTENARIAT = {
  marque: "Entreprise ou marque",
  sponsor_cadeaux: "Sponsor de cadeaux",
  curateur: "Curateur",
  influenceur: "Influenceur ou page fan",
  media: "Média, blog ou radio",
  pronostiqueur: "Pronostiqueur",
  chercheur: "Chercheur ou étude",
  autre: "Autre",
} as const;
export type TypePartenariat = keyof typeof TYPES_PARTENARIAT;

export function estTypePartenariat(v: unknown): v is TypePartenariat {
  return typeof v === "string" && v in TYPES_PARTENARIAT;
}

export const OFFRES: { type: TypePartenariat; titre: string; texte: string; gain: string; bouton: string; ombre: string; lien?: string }[] = [
  {
    type: "marque",
    titre: "Entreprises et marques",
    texte: "Publicité dans l'application, ou sponsoring d'un marché ou d'un classement : « Question offerte par… ».",
    gain: "Visibilité auprès de milliers de jeunes Congolais.",
    bouton: "Nous contacter",
    ombre: "shadow-[6px_6px_0_#A7C957]",
  },
  {
    type: "sponsor_cadeaux",
    titre: "Sponsors de cadeaux",
    texte: "Financez du crédit, des forfaits internet ou vos produits pour les gagnants.",
    gain: "Votre marque sur les cadeaux et les annonces des gagnants.",
    bouton: "Nous contacter",
    ombre: "shadow-[6px_6px_0_#BC4749]",
  },
  {
    type: "curateur",
    titre: "Curateurs",
    texte: "Animez une communauté (musique, foot, ville, université) et approuvez ses questions.",
    gain: "Badge, pièces bonus, et plus tard une part des revenus de votre communauté.",
    bouton: "Postuler",
    ombre: "shadow-[6px_6px_0_#6A994E]",
    lien: "/curateur",
  },
  {
    type: "influenceur",
    titre: "Influenceurs et pages fans",
    texte: "Amenez vos abonnés avec votre lien d'invitation personnel.",
    gain: "Une récompense pour chaque utilisateur actif que vous amenez.",
    bouton: "Obtenir mon lien",
    ombre: "shadow-[6px_6px_0_#A7C957]",
  },
  {
    type: "media",
    titre: "Médias, blogs et radios",
    texte: "Citez ou intégrez les pourcentages KongoX : « Ce que pense Kinshasa ».",
    gain: "Du contenu gratuit et frais pour votre public, chaque semaine.",
    bouton: "Nous contacter",
    ombre: "shadow-[6px_6px_0_#BC4749]",
  },
  {
    type: "pronostiqueur",
    titre: "Meilleurs pronostiqueurs",
    texte: "Vendez vos analyses premium à vos abonnés (bientôt).",
    gain: "Un revenu mensuel grâce à vos abonnés.",
    bouton: "Me prévenir",
    ombre: "shadow-[6px_6px_0_#6A994E]",
  },
  {
    type: "chercheur",
    titre: "Chercheurs et marques",
    texte: "Achetez des rapports d'opinion anonymes sur les jeunes Congolais (bientôt).",
    gain: "De vraies données sur ce que pense le terrain.",
    bouton: "Me prévenir",
    ombre: "shadow-[6px_6px_0_#A7C957]",
  },
];
