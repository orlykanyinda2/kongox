import { Suspense } from "react";
import Link from "next/link";
import { EnTetePage, Section, Vide } from "@/components/admin/ui";
import { Reglement } from "@/components/admin/Reglement";
import { exigerAdmin } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate, formaterNombre } from "@/lib/format";
import { LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";

export default function PageResultats() {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
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
  options: { id: number; libelle: string; ordre: number; total_mise: number }[];
};

// Marchés fermés (ou dont la date de fin est passée) en attente de leur résultat
async function Resultats() {
  await exigerAdmin();
  const supabase = await creerClientServeur();
  const maintenant = new Date().toISOString();
  const { data } = await supabase
    .from("marches")
    .select("id, question, categorie, source, date_fin, options:options_marche!options_marche_marche_id_fkey(id, libelle, ordre, total_mise)")
    .or(`statut.eq.ferme,and(statut.eq.approuve,date_fin.lte.${maintenant})`)
    .order("date_fin")
    .returns<Ligne[]>();

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre="Résultats à régler"
        description="Choisis la bonne réponse et colle le lien de la source. Les gains sont versés tout de suite, automatiquement. Les plus anciens en premier."
      />
      <Section titre={`${(data ?? []).length} marché(s) à régler`} className="[&>div:last-child]:p-0">
        {(data ?? []).length === 0 && <Vide>Aucun marché à régler.</Vide>}
        {(data ?? []).map((m) => {
          const options = [...m.options].sort((a, b) => a.ordre - b.ordre);
          return (
            <article key={m.id} className="flex flex-col gap-2 border-b border-adm-bordure px-4 py-3.5 last:border-b-0">
              <div className="text-[13px] text-adm-secondaire">
                n° {m.id} · {LIBELLES_CATEGORIES[m.categorie]} · fermé le {formaterDate(m.date_fin)} · source : {m.source} ·{" "}
                {options.map((o) => `${o.libelle} ${formaterNombre(o.total_mise)}`).join(" / ")} pièces
              </div>
              <Link href={`/admin/marches/${m.id}`} className="text-[15px] font-semibold hover:underline">
                {m.question}
              </Link>
              <Reglement marche={m.id} options={options} />
            </article>
          );
        })}
      </Section>
    </div>
  );
}
