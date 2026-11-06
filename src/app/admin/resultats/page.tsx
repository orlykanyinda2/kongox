import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FormulaireReglement } from "@/components/admin/FormulaireReglement";
import { BoutonAction } from "@/components/admin/BoutonAction";
import { EtiquetteCategorie } from "@/components/marches/EtiquetteCategorie";
import { definirSoki } from "@/app/actions/admin";
import { exigerAdmin } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterNombre } from "@/lib/format";
import type { Categorie } from "@/lib/marches/categories";

export default function PageResultats() {
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-carte bg-doux" />}>
      <Resultats />
    </Suspense>
  );
}

type Ligne = {
  id: number;
  question: string;
  categorie: Categorie;
  source: string;
  date_fin: string;
  statut: string;
  soki_du_jour: boolean;
  options: { id: number; libelle: string; ordre: number; total_mise: number }[];
};

const dateFin = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kinshasa" });

// Résultats à régler (marchés fermés) + marchés ouverts (Soki du jour, annulation)
async function Resultats() {
  await exigerAdmin();
  const t = await getTranslations("admin");
  const supabase = await creerClientServeur();
  const maintenant = new Date().toISOString();
  const champs = "id, question, categorie, source, date_fin, statut, soki_du_jour, options:options_marche!options_marche_marche_id_fkey(id, libelle, ordre, total_mise)";

  const [{ data: aRegler }, { data: ouverts }] = await Promise.all([
    supabase.from("marches").select(champs).or(`statut.eq.ferme,and(statut.eq.approuve,date_fin.lte.${maintenant})`).order("date_fin").returns<Ligne[]>(),
    supabase.from("marches").select(champs).eq("statut", "approuve").gt("date_fin", maintenant).order("date_fin").returns<Ligne[]>(),
  ]);

  const totaux = (m: Ligne) => [...m.options].sort((a, b) => a.ordre - b.ordre);

  return (
    <main className="flex flex-col gap-[22px]">
      <div>
        <h1 className="text-[32px] tracking-[-1px] md:text-4xl">{t("resultatsTitre")}</h1>
        <p className="mt-1.5 text-[15px] text-texte-secondaire">{t("resultatsTexte")}</p>
      </div>

      {(aRegler ?? []).length === 0 ? (
        <div className="rounded-carte border-2 border-dashed border-sauge p-8 text-center font-bold">{t("aucunAregler")}</div>
      ) : (
        aRegler!.map((m) => (
          <article key={m.id} className="flex flex-col gap-3 rounded-carte border-2 border-contour bg-surface p-5 shadow-decale-md">
            <div className="flex flex-wrap items-center gap-2.5">
              <EtiquetteCategorie categorie={m.categorie} petite />
              <span className="text-[13px] text-texte-secondaire">{t("fermeLe", { date: dateFin.format(new Date(m.date_fin)) })}</span>
            </div>
            <h2 className="text-[21px] leading-[1.25]">
              <Link href={`/marches/${m.id}`} className="hover:underline">
                {m.question}
              </Link>
            </h2>
            <p className="text-sm text-texte-secondaire">
              {t("source")} <strong className="text-texte">{m.source}</strong> ·{" "}
              {totaux(m).map((o) => `${o.libelle} ${formaterNombre(o.total_mise)}`).join(" · ")} {t("pieces")}
            </p>
            <FormulaireReglement marche={m.id} options={totaux(m)} />
          </article>
        ))
      )}

      <section className="mt-4 flex flex-col gap-3">
        <h2 className="text-2xl">{t("marchesOuverts")}</h2>
        <p className="text-sm text-texte-secondaire">{t("marchesOuvertsTexte")}</p>
        <ul className="flex flex-col rounded-carte border-2 border-contour bg-surface p-2">
          {(ouverts ?? []).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 border-b border-separateur px-2 py-3 last:border-b-0">
              <EtiquetteCategorie categorie={m.categorie} petite />
              <Link href={`/marches/${m.id}`} className="min-w-0 flex-[1_1_260px] font-semibold hover:underline">
                {m.question}
              </Link>
              <span className="text-xs text-texte-secondaire">
                {formaterNombre(m.options.reduce((s, o) => s + o.total_mise, 0))} {t("pieces")}
              </span>
              {m.soki_du_jour ? (
                <span className="rounded-full border-2 border-foret bg-brique px-2.5 py-1 text-xs font-bold text-white">{t("sokiActuel")}</span>
              ) : (
                <BoutonAction action={definirSoki.bind(null, m.id)} libelle={t("mettreSoki")} petit />
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
