import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Chiffre, EnTetePage, Section } from "@/components/admin/ui";
import { GraphiqueSerie } from "@/components/admin/GraphiqueSerie";
import { exigerAcces } from "@/lib/admin/acces";
import { valeur, type Params } from "@/lib/admin/tableau";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterNombre } from "@/lib/format";

export default function PageTableauDeBord({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <TableauDeBord searchParams={searchParams} />
    </Suspense>
  );
}

type Jour = { jour: string; inscrits: number; actifs: number; predictions: number; pieces_misees: number };

const PERIODES = { "7": { jours: 7, libelle: "7 jours" }, "30": { jours: 30, libelle: "30 jours" }, tout: { jours: null, libelle: "Tout" } } as const;

async function TableauDeBord({ searchParams }: { searchParams: Promise<Params> }) {
  const acces = await exigerAcces();
  if (!acces.admin) redirect("/admin/approbation");
  const params = await searchParams;
  const cle = (valeur(params, "periode") || "7") as keyof typeof PERIODES;
  const periode = PERIODES[cle] ?? PERIODES["7"];

  const supabase = await creerClientServeur();
  const [{ data: jour }, { data: serie }] = await Promise.all([
    supabase.rpc("tableau_de_bord"),
    supabase.rpc("series_tableau_de_bord", { p_jours: periode.jours }),
  ]);
  const d = (jour ?? {}) as Record<string, number>;
  const points = ((serie ?? []) as Jour[]).map((p) => ({ ...p, inscrits: Number(p.inscrits), actifs: Number(p.actifs), predictions: Number(p.predictions), pieces_misees: Number(p.pieces_misees) }));
  const series = (k: keyof Omit<Jour, "jour">) => points.map((p) => ({ jour: p.jour, valeur: p[k] }));

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre="Tableau de bord" description="Chiffres du jour (heure de Kinshasa). Un compte actif a reçu son bonus de connexion ou a misé ce jour-là." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Chiffre valeur={formaterNombre(d.inscrits ?? 0)} libelle="Nouveaux inscrits" lien="/admin/utilisateurs?tri=cree_le" />
        <Chiffre valeur={formaterNombre(d.actifs ?? 0)} libelle="Comptes actifs" />
        <Chiffre valeur={formaterNombre(d.predictions ?? 0)} libelle="Prédictions" />
        <Chiffre valeur={formaterNombre(d.pieces_misees ?? 0)} libelle="Pièces misées" />
        <Chiffre valeur={formaterNombre(d.en_attente ?? 0)} libelle="Questions en attente" lien="/admin/approbation" alerte={(d.en_attente ?? 0) > 0} />
        <Chiffre valeur={formaterNombre(d.a_regler ?? 0)} libelle="Marchés à régler" lien="/admin/resultats" alerte={(d.a_regler ?? 0) > 0} />
      </div>
      <p className="text-[13px] text-adm-secondaire">
        {formaterNombre(d.utilisateurs ?? 0)} comptes · {formaterNombre(d.en_ligne ?? 0)} marchés en ligne · {formaterNombre(d.programmes ?? 0)} programmés
      </p>

      <Section
        titre={`Évolution — ${periode.libelle}`}
        actions={
          <div className="flex gap-1" role="group" aria-label="Période">
            {(Object.keys(PERIODES) as (keyof typeof PERIODES)[]).map((k) => (
              <Link
                key={k}
                href={`/admin?periode=${k}`}
                aria-current={k === cle ? "true" : undefined}
                className={`rounded-md px-2.5 py-1 text-[13px] ${k === cle ? "bg-adm-accent font-semibold text-white" : "border border-adm-bordure hover:bg-adm-zone"}`}
              >
                {PERIODES[k].libelle}
              </Link>
            ))}
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <GraphiqueSerie titre="Nouveaux inscrits" points={series("inscrits")} />
          <GraphiqueSerie titre="Comptes actifs" points={series("actifs")} />
          <GraphiqueSerie titre="Prédictions" points={series("predictions")} />
          <GraphiqueSerie titre="Pièces misées" points={series("pieces_misees")} unite="pièces" />
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-adm-accent">Voir le tableau des valeurs</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-adm-zone text-left">
                <tr>
                  {["Jour", "Inscrits", "Actifs", "Prédictions", "Pièces misées"].map((t, i) => (
                    <th key={t} scope="col" className={`border-b border-adm-bordure px-2 py-1.5 font-semibold ${i ? "text-right" : ""}`}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.jour} className="border-b border-adm-bordure">
                    <td className="px-2 py-1">{new Date(`${p.jour}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" })}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formaterNombre(p.inscrits)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formaterNombre(p.actifs)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formaterNombre(p.predictions)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formaterNombre(p.pieces_misees)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Section>
    </div>
  );
}
