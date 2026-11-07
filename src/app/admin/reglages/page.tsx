import { Suspense } from "react";
import { EnTetePage, Section } from "@/components/admin/ui";
import { FormulaireReglage } from "@/components/admin/FormulaireReglage";
import { exigerAdmin } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate, formaterNombre } from "@/lib/format";

export default function PageReglages() {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Reglages />
    </Suspense>
  );
}

type Reglage = {
  cle: string;
  libelle: string;
  valeur: number | null;
  texte: string | null;
  minimum: number | null;
  maximum: number | null;
  modifie_le: string;
  auteur: { nom_utilisateur: string } | null;
};

// Règles du jeu modifiables. Les montants affichés dans l'application suivent ces valeurs.
async function Reglages() {
  await exigerAdmin();
  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("reglages")
    .select("cle, libelle, valeur, texte, minimum, maximum, modifie_le, auteur:utilisateurs!reglages_modifie_par_fkey(nom_utilisateur)")
    .order("cle")
    .returns<Reglage[]>();

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre="Réglages"
        description="Règles des pièces et du jeu. Chaque valeur a des limites de sécurité. Les textes de l'application (« 1 000 pièces offertes »…) se mettent à jour automatiquement."
      />
      <Section className="[&>div:last-child]:p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-adm-zone text-left text-[13px]">
              <tr>
                {["Réglage", "Valeur", "Limites", "Dernière modification"].map((t) => (
                  <th key={t} scope="col" className="border-b border-adm-bordure px-3 py-2 font-semibold">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.cle} className="border-b border-adm-bordure last:border-b-0">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.libelle}</div>
                    <div className="text-xs text-adm-secondaire">{r.cle}</div>
                  </td>
                  <td className="px-3 py-2">
                    <FormulaireReglage cle={r.cle} valeur={String(r.valeur ?? r.texte ?? "")} numerique={r.valeur !== null} minimum={r.minimum} maximum={r.maximum} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[13px] text-adm-secondaire tabular-nums">
                    {r.valeur !== null ? `${formaterNombre(r.minimum ?? 0)} à ${formaterNombre(r.maximum ?? 0)}` : "chiffres seulement"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[13px] text-adm-secondaire">
                    {r.auteur ? `${formaterDate(r.modifie_le)} par @${r.auteur.nom_utilisateur}` : "valeur d'origine"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <p className="text-xs text-adm-secondaire">
        Les changements s&apos;appliquent aux prochaines opérations (une mise déjà faite ne change pas). Chaque modification est écrite dans le journal.
      </p>
    </div>
  );
}
