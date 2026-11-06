import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { FormulaireMotDePasse } from "@/components/admin/Formulaires";
import { exigerAdmin } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate } from "@/lib/format";

export default function PageMotsDePasse() {
  return (
    <Suspense fallback={<div className="h-[400px] animate-pulse rounded-carte bg-doux" />}>
      <MotsDePasse />
    </Suspense>
  );
}

// Réinitialisation des mots de passe : l'utilisateur envoie son nom sur WhatsApp, l'admin génère un mot de passe temporaire.
async function MotsDePasse() {
  await exigerAdmin();
  const t = await getTranslations("admin");
  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("journal_admin")
    .select("id, cree_le, auteur:utilisateurs!journal_admin_auteur_id_fkey(nom_utilisateur), cible:utilisateurs!journal_admin_cible_utilisateur_fkey(nom_utilisateur)")
    .eq("action", "mot_de_passe_reinitialise")
    .order("cree_le", { ascending: false })
    .limit(15)
    .returns<{ id: number; cree_le: string; auteur: { nom_utilisateur: string } | null; cible: { nom_utilisateur: string } | null }[]>();

  return (
    <main className="flex max-w-[640px] flex-col gap-5">
      <h1 className="text-[32px] tracking-[-1px] md:text-4xl">{t("menu.motsDePasse")}</h1>
      <ol className="list-decimal pl-5 text-[15px] leading-relaxed">
        <li>{t("mdpEtape1")}</li>
        <li>{t("mdpEtape2")}</li>
        <li>{t("mdpEtape3")}</li>
      </ol>
      <FormulaireMotDePasse />
      <section className="rounded-carte border-2 border-contour bg-surface p-5">
        <h2 className="text-xl">{t("dernieresReinitialisations")}</h2>
        <ul className="mt-2 text-sm">
          {(data ?? []).map((j) => (
            <li key={j.id} className="border-b border-separateur py-2 last:border-b-0">
              {t("reinitialisePar", { cible: j.cible?.nom_utilisateur ?? "?", auteur: j.auteur?.nom_utilisateur ?? "?", date: formaterDate(j.cree_le) })}
            </li>
          ))}
          {(data ?? []).length === 0 && <li className="py-2 text-texte-secondaire">{t("aucuneReinitialisation")}</li>}
        </ul>
      </section>
    </main>
  );
}
