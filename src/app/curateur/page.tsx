import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { FormulaireCandidature } from "@/components/compte/FormulaireCandidature";
import { utilisateurConnecte } from "@/lib/compte/session";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";

export const metadata = { title: "Devenir curateur — KongoX" };

// « Devenir curateur » : candidature, puis période d'essai, puis autonomie dans le thème.
export default function PageCurateur() {
  const t = useTranslations("curateur");
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <main className="mx-auto w-full max-w-[640px] flex-1 px-[18px] py-6">
        <h1 className="text-[32px] tracking-[-1px]">{t("titre")}</h1>
        <p className="mt-2 text-[15px] leading-normal text-texte-secondaire">{t("intro")}</p>
        <ol className="mt-4 flex flex-col gap-2">
          {[1, 2, 3].map((n) => (
            <li key={n} className="flex items-start gap-3 rounded-champ bg-doux p-3 text-sm">
              <span className="flex size-8 flex-none items-center justify-center rounded-[10px] bg-foret font-titre font-bold text-vert-jaune">{n}</span>
              <span>{t(`etape${n}`)}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <Suspense fallback={<div className="h-[380px] animate-pulse rounded-carte bg-doux" />}>
            <Contenu />
          </Suspense>
        </div>
      </main>
      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}

async function Contenu() {
  const u = await utilisateurConnecte();
  if (!u) redirect("/connexion");
  const t = await getTranslations("curateur");
  const supabase = await creerClientServeur();
  const [{ data: candidatures }, { data: themes }] = await Promise.all([
    supabase.from("candidatures_curateur").select("id, categorie, statut, cree_le").order("cree_le", { ascending: false }).returns<{ id: number; categorie: Categorie; statut: string; cree_le: string }[]>(),
    supabase.from("curateurs").select("categorie, statut, decisions_validees").eq("utilisateur_id", u.id).returns<{ categorie: Categorie; statut: string; decisions_validees: number }[]>(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      {(themes ?? []).length > 0 && (
        <section className="rounded-carte border-2 border-foret bg-hunter p-5 text-white shadow-brique-md">
          <h2 className="text-xl">{t("tesThemes")}</h2>
          <ul className="mt-2 text-[15px]">
            {themes!.map((th) => (
              <li key={th.categorie}>
                {LIBELLES_CATEGORIES[th.categorie]} — {th.statut === "autonome" ? t("autonome") : t("essai", { n: th.decisions_validees })}
              </li>
            ))}
          </ul>
          <Link href="/admin" className="mt-3 inline-flex h-11 items-center rounded-bouton bg-vert-jaune px-4 font-bold text-foret">
            {t("ouvrirFile")}
          </Link>
        </section>
      )}
      <FormulaireCandidature />
      {(candidatures ?? []).length > 0 && (
        <section className="rounded-carte border-2 border-contour bg-surface p-5">
          <h2 className="text-lg">{t("mesCandidatures")}</h2>
          <ul className="mt-2 text-sm">
            {candidatures!.map((c) => (
              <li key={c.id} className="flex justify-between border-b border-separateur py-2 last:border-b-0">
                <span>{LIBELLES_CATEGORIES[c.categorie]}</span>
                <strong>{t(`statut.${c.statut}`)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
