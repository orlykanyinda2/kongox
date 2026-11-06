import { useTranslations } from "next-intl";
import { BoutonTheme } from "@/components/BoutonTheme";

// Page d'attente de l'étape 0 : sert seulement à vérifier le thème, les polices et les traductions.
// Elle sera remplacée par la vraie page d'accueil à l'étape 2.
export default function Attente() {
  const t = useTranslations();

  return (
    <main className="relative mx-auto flex w-full max-w-contenu flex-1 flex-col items-center justify-center gap-6 px-[18px] py-14 text-center md:px-6">
      <div className="absolute right-[18px] top-[18px] md:right-6">
        <BoutonTheme />
      </div>

      <h1 className="animate-monte font-titre text-[44px] leading-[0.98] tracking-[-1px] md:text-[clamp(44px,6vw,84px)] md:tracking-[-2px]">
        {t("attente.titre")}{" "}
        <span className="inline-block animate-rebond rounded-bouton contour-kx bg-vert-jaune px-3 text-foret shadow-brique">
          {t("attente.pastille")}
        </span>
      </h1>

      <p className="max-w-md text-[15px] text-texte-secondaire md:text-[17px]">{t("attente.texte")}</p>

      <p className="inline-flex items-center gap-2 rounded-full contour-kx bg-doux px-4 py-2 text-sm font-semibold">
        <span className="size-2.5 animate-pulse-direct rounded-full bg-brique" aria-hidden="true" />
        {t("commun.jamaisArgentReel")}
      </p>
    </main>
  );
}
