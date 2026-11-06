import { Suspense } from "react";
import Link from "next/link";
import { NextIntlClientProvider, useMessages, useTranslations } from "next-intl";
import { BoutonTheme } from "@/components/BoutonTheme";
import { NavAdmin, type CompteursAdmin } from "@/components/admin/NavAdmin";
import { lireAcces } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";

export const metadata = { title: "Admin — KongoX", robots: { index: false } };

// Panneau admin (maquettes/Admin.dc.html) : en-tête Hunter Green, menu à gauche, contenu au centre.
// Les textes « admin » ne sont envoyés au navigateur que dans ces pages.
export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  const t = useTranslations("admin");
  const tous = useMessages();

  return (
    <NextIntlClientProvider messages={{ admin: tous.admin, erreursAdmin: tous.erreursAdmin, theme: tous.theme }}>
      <div className="flex min-h-full flex-1 flex-col">
        <header className="border-b-2 border-foret bg-hunter text-white">
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-4 px-[18px] py-3.5 md:px-6">
            <Link href="/" className="font-titre text-2xl font-bold">
              Kongo<span className="ml-0.5 rounded-lg bg-vert-jaune px-1.5 text-foret">X</span>
            </Link>
            <span className="rounded-full border-2 border-foret bg-brique px-[11px] py-[5px] text-xs font-bold">{t("badge")}</span>
            <span className="flex-1" />
            <Suspense fallback={null}>
              <Connecte />
            </Suspense>
            <BoutonTheme />
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-6 px-[18px] py-7 md:px-6 lg:flex-row lg:items-start">
          <div className="lg:w-[260px] lg:flex-none">
            <Suspense fallback={<div className="h-[420px] rounded-carte border-2 border-contour bg-doux" />}>
              <Menu />
            </Suspense>
          </div>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}

async function Connecte() {
  const acces = await lireAcces();
  if (!acces) return null;
  return (
    <span className="text-sm text-[#E4EAD3]">
      @<strong className="text-white">{acces.utilisateur.nom_utilisateur}</strong>
    </span>
  );
}

async function Menu() {
  const acces = await lireAcces();
  if (!acces) return null;
  let compteurs: CompteursAdmin | null = null;
  if (acces.admin) {
    const supabase = await creerClientServeur();
    const { data } = await supabase.rpc("statistiques_admin");
    compteurs = data as CompteursAdmin;
  }
  return <NavAdmin admin={acces.admin} compteurs={compteurs} />;
}
