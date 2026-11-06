import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BoutonAction } from "@/components/admin/BoutonAction";
import { changerStatutCurateur, traiterCandidature } from "@/app/actions/admin";
import { exigerAdmin } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate } from "@/lib/format";

export default function PageCurateurs() {
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-carte bg-doux" />}>
      <Curateurs />
    </Suspense>
  );
}

const SEUIL = 10; // même valeur que seuil_essai_curateur() en SQL
const carte = "rounded-carte border-2 border-contour bg-surface p-5 shadow-decale-md";

// Candidatures, période d'essai (décisions validées par un admin) puis autonomie dans le thème.
async function Curateurs() {
  await exigerAdmin();
  const t = await getTranslations("admin");
  const supabase = await creerClientServeur();

  const [{ data: candidatures }, { data: curateurs }, { count: decisions }] = await Promise.all([
    supabase
      .from("candidatures_curateur")
      .select("id, categorie, motivation, cree_le, candidat:utilisateurs!candidatures_curateur_utilisateur_id_fkey(id, nom_utilisateur)")
      .eq("statut", "en_attente")
      .order("cree_le")
      .returns<{ id: number; categorie: string; motivation: string; cree_le: string; candidat: { id: string; nom_utilisateur: string } | null }[]>(),
    supabase
      .from("curateurs")
      .select("utilisateur_id, categorie, statut, decisions_validees, curateur:utilisateurs!curateurs_utilisateur_id_fkey(nom_utilisateur)")
      .order("cree_le")
      .returns<{ utilisateur_id: string; categorie: string; statut: string; decisions_validees: number; curateur: { nom_utilisateur: string } | null }[]>(),
    supabase.from("decisions_curateur").select("id", { count: "exact", head: true }).eq("statut", "a_valider"),
  ]);

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-[32px] tracking-[-1px] md:text-4xl">{t("menu.curateurs")}</h1>
        <p className="mt-1.5 text-[15px] text-texte-secondaire">{t("curateursTexte", { seuil: SEUIL })}</p>
      </div>

      {(decisions ?? 0) > 0 && (
        <Link href="/admin" className="rounded-carte border-2 border-foret bg-vert-jaune p-4 font-bold text-foret shadow-foret">
          {t("decisionsAValider", { n: decisions ?? 0 })}
        </Link>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">{t("candidatures")}</h2>
        {(candidatures ?? []).length === 0 && <p className="rounded-carte border-2 border-dashed border-sauge p-6 text-center font-bold">{t("aucuneCandidature")}</p>}
        {(candidatures ?? []).map((c) => (
          <article key={c.id} className={`${carte} flex flex-col gap-2`}>
            <div className="flex flex-wrap items-center gap-2.5">
              <strong>@{c.candidat?.nom_utilisateur}</strong>
              <span className="rounded-full bg-doux px-2.5 py-1 text-xs font-bold">{t(`categories.${c.categorie}`)}</span>
              <span className="text-xs text-texte-secondaire">{formaterDate(c.cree_le)}</span>
            </div>
            <p className="text-[15px] leading-normal">« {c.motivation} »</p>
            <div className="flex flex-wrap gap-2.5">
              <BoutonAction action={traiterCandidature.bind(null, c.id, true)} libelle={t("accepterEssai")} variante="oui" />
              <BoutonAction action={traiterCandidature.bind(null, c.id, false)} libelle={t("refuser")} variante="non" />
            </div>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">{t("curateursActuels")}</h2>
        <ul className={`${carte} flex flex-col p-2`}>
          {(curateurs ?? []).map((c) => (
            <li key={`${c.utilisateur_id}-${c.categorie}`} className="flex flex-wrap items-center gap-3 border-b border-separateur px-2 py-3 last:border-b-0">
              <Link href={`/admin/utilisateurs/${c.utilisateur_id}`} className="font-bold hover:underline">
                @{c.curateur?.nom_utilisateur}
              </Link>
              <span className="rounded-full bg-doux px-2.5 py-1 text-xs font-bold">{t(`categories.${c.categorie}`)}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${c.statut === "autonome" ? "bg-vert-jaune text-foret" : "bg-champagne text-foret"}`}>
                {c.statut === "autonome" ? t("autonome") : t("enEssai", { n: c.decisions_validees, seuil: SEUIL })}
              </span>
              <span className="flex-1" />
              {c.statut === "essai" ? (
                <BoutonAction action={changerStatutCurateur.bind(null, c.utilisateur_id, c.categorie, "autonome")} libelle={t("rendreAutonome")} petit />
              ) : (
                <BoutonAction action={changerStatutCurateur.bind(null, c.utilisateur_id, c.categorie, "essai")} libelle={t("remettreEssai")} petit />
              )}
              <BoutonAction
                action={changerStatutCurateur.bind(null, c.utilisateur_id, c.categorie, "retirer")}
                libelle={t("retirer")}
                variante="non"
                petit
                confirmation={t("confirmerRetrait", { nom: c.curateur?.nom_utilisateur ?? "" })}
              />
            </li>
          ))}
          {(curateurs ?? []).length === 0 && <li className="p-4 text-sm">{t("aucunCurateur")}</li>}
        </ul>
      </section>
    </main>
  );
}
