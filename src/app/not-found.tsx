import Link from "next/link";
import { useTranslations } from "next-intl";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";

// Page introuvable (marché, profil, communauté inconnus). La page partenaires arrive à l'étape 6.
export default function Introuvable() {
  const t = useTranslations("introuvable");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-[18px] py-16 text-center">
      <span className="inline-block -rotate-2 rounded-2xl border-[3px] border-foret bg-vert-jaune px-4 py-1 font-titre text-4xl font-bold text-foret shadow-[5px_5px_0_#1F3A26]">
        {t("bientot")}
      </span>
      <h1 className="text-[28px] leading-tight">{t("titre")}</h1>
      <p className="text-[15px] text-texte-secondaire">{t("texte")}</p>
      <Link href="/marches" className="flex h-12 items-center rounded-bouton bg-foret px-6 font-bold text-white dark:border-2 dark:border-vert-jaune">
        {t("accueil")}
      </Link>
      <BarreNavigation />
    </main>
  );
}
