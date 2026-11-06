import { useTranslations } from "next-intl";

export function PiedDePage() {
  const t = useTranslations("commun");
  return (
    <footer className="border-t-2 border-contour">
      <div className="mx-auto flex max-w-contenu flex-wrap justify-between gap-4 px-[18px] py-8 pb-28 text-sm text-texte-secondaire md:px-6 md:pb-8">
        <span>
          <strong className="font-titre text-texte">KongoX</strong> — Reality. Probability. Insight.
        </span>
        <span>{t("jeuGratuitModeration")}</span>
      </div>
    </footer>
  );
}
