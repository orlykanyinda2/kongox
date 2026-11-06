import { Suspense } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/Logo";
import { BoutonTheme } from "@/components/BoutonTheme";
import { IconePiece } from "@/components/IconePiece";
import { utilisateurConnecte } from "@/lib/compte/session";
import { formaterNombre } from "@/lib/format";
import { getTranslations } from "next-intl/server";

// En-tête collant (maquettes Main et Mobile) : logo, liens, recherche, solde, mode sombre, compte.
export function EnTete() {
  const t = useTranslations("entete");
  const tc = useTranslations("commun");

  return (
    <header className="sticky top-0 z-20 border-b-2 border-contour bg-entete">
      <div className="mx-auto flex max-w-contenu flex-wrap items-center gap-3 px-[18px] py-3 md:gap-5 md:px-6 md:py-3.5">
        <Logo libelle={tc("accueilLogo")} />

        <nav aria-label={t("navigation")} className="hidden flex-wrap gap-1 lg:flex">
          <Link href="/#marches" className="rounded-[10px] px-3.5 py-2.5 text-[15px] font-semibold text-texte hover:bg-doux">
            {t("marches")}
          </Link>
          <Link href="/football" className="rounded-[10px] px-3.5 py-2.5 text-[15px] font-semibold text-texte hover:bg-doux">
            {t("football")}
          </Link>
          <Link href="/classement" className="rounded-[10px] px-3.5 py-2.5 text-[15px] font-semibold text-texte hover:bg-doux">
            {t("classement")}
          </Link>
          <Link href="/partenaires" className="rounded-[10px] px-3.5 py-2.5 text-[15px] font-semibold text-texte hover:bg-doux">
            {t("partenaires")}
          </Link>
        </nav>

        <form action="/" method="get" role="search" className="hidden min-w-[180px] flex-[1_1_200px] md:block">
          <label htmlFor="recherche" className="sr-only">
            {t("rechercher")}
          </label>
          <input
            id="recherche"
            name="q"
            type="search"
            placeholder={t("rechercherExemple")}
            className="h-11 w-full rounded-bouton border border-separateur bg-doux px-4 text-[15px] text-texte outline-none focus-visible:ring-4 focus-visible:ring-vert-jaune/60"
          />
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-0 md:gap-2.5">
          <Suspense fallback={null}>
            <ZoneCompte />
          </Suspense>
          <BoutonTheme />
          <Suspense fallback={null}>
            <BoutonCompte />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

// Solde de pièces (si connecté)
async function ZoneCompte() {
  const u = await utilisateurConnecte();
  if (!u) return null;
  const t = await getTranslations("entete");
  return (
    <Link
      href="/profil"
      aria-label={t("soldeLibelle", { solde: formaterNombre(u.solde_pieces) })}
      className="flex h-11 items-center gap-2 rounded-bouton bg-doux px-3 text-sm font-bold text-texte md:px-3.5 md:text-[15px]"
    >
      <IconePiece taille={20} />
      <span>
        {formaterNombre(u.solde_pieces)}
        <span className="hidden md:inline"> {t("pieces")}</span>
      </span>
    </Link>
  );
}

// « Créer un compte » si visiteur, « Mon profil » si connecté (sur mobile, la barre du bas suffit)
async function BoutonCompte() {
  const u = await utilisateurConnecte();
  const t = await getTranslations("entete");
  if (u) {
    const admin = u.role === "admin" || u.role === "curateur";
    return (
      <>
        {admin && (
          <Link href="/admin" className="hidden h-11 items-center rounded-bouton border-2 border-foret bg-brique px-3.5 text-sm font-bold text-white md:flex">
            {t("admin")}
          </Link>
        )}
      <Link href="/profil" className="hidden h-11 items-center rounded-bouton border-2 border-contour bg-surface px-4 text-[15px] font-bold text-texte md:flex">
        {t("monProfil")}
      </Link>
      </>
    );
  }
  return (
    <Link
      href="/inscription"
      className="hidden h-11 items-center rounded-bouton bg-foret px-[18px] text-[15px] font-bold text-white shadow-[3px_3px_0_#A7C957] md:flex dark:border-2 dark:border-vert-jaune"
    >
      {t("creerCompte")}
    </Link>
  );
}
