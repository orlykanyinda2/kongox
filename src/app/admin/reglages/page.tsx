import { Suspense } from "react";
import { EnTetePage, Section } from "@/components/admin/ui";
import { FormulaireReglage } from "@/components/admin/FormulaireReglage";
import { exigerAdmin } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate, formaterNombre } from "@/lib/format";
import { BoutonAction } from "@/components/admin/Actions";
import { recalculerScoresFil } from "@/app/actions/backoffice";

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
      <ReglagesFil />
      <p className="text-xs text-adm-secondaire">
        Les changements s&apos;appliquent aux prochaines opérations (une mise déjà faite ne change pas). Chaque modification est écrite dans le journal.
      </p>
    </div>
  );
}

type ReglageFil = {
  cle: string;
  groupe: "coefficient" | "section" | "affichage";
  libelle: string;
  valeur: number;
  minimum: number;
  maximum: number;
  modifie_le: string;
  auteur: { nom_utilisateur: string } | null;
};

const GROUPES = [
  { groupe: "section", titre: "Fil de marchés : sections de l'accueil", aide: "Une section cachée disparaît de l'accueil. Les sections « phase 2 » sont prêtes mais cachées." },
  { groupe: "coefficient", titre: "Fil de marchés : score de tendance et phase 2", aide: "score = (A × prédicteurs 24 h + B × commentaires 24 h + pièces 24 h ÷ C) ÷ (heures depuis la publication + 2)^G, + bonus pendant H heures. Voir docs/ALGORITHME.md." },
  { groupe: "affichage", titre: "Fil de marchés : affichage", aide: "Taille des sections et règle de diversité (même catégorie au maximum K fois dans les N premiers)." },
] as const;

// Réglages du fil (table reglages_fil). Les scores sont recalculés toutes les 10 minutes.
async function ReglagesFil() {
  const supabase = await creerClientServeur();
  const [{ data }, { data: calcul }] = await Promise.all([
    supabase
      .from("reglages_fil")
      .select("cle, groupe, libelle, valeur, minimum, maximum, modifie_le, auteur:utilisateurs!reglages_fil_modifie_par_fkey(nom_utilisateur)")
      .order("ordre")
      .returns<ReglageFil[]>(),
    supabase.from("scores_marches").select("calcule_le").order("calcule_le", { ascending: false }).limit(1).maybeSingle<{ calcule_le: string }>(),
  ]);
  const lignes = data ?? [];
  return (
    <>
      {GROUPES.map((g) => (
        <Section
          key={g.groupe}
          titre={g.titre}
          className="[&>div:last-child]:p-0"
          actions={
            g.groupe === "coefficient" ? (
              <div className="flex items-center gap-2 text-xs text-adm-secondaire">
                {calcul ? `Dernier calcul : ${formaterDate(calcul.calcule_le)}` : "Pas encore calculé"}
                <BoutonAction action={recalculerScoresFil} libelle="Recalculer maintenant" />
              </div>
            ) : undefined
          }
        >
          <p className="border-b border-adm-bordure px-3 py-2 text-[13px] text-adm-secondaire">{g.aide}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {lignes
                  .filter((r) => r.groupe === g.groupe)
                  .map((r) => (
                    <tr key={r.cle} className="border-b border-adm-bordure last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.libelle}</div>
                        <div className="text-xs text-adm-secondaire">{r.cle}</div>
                      </td>
                      <td className="px-3 py-2">
                        <FormulaireReglage
                          fil
                          cle={r.cle}
                          valeur={String(Number(r.valeur))}
                          numerique
                          minimum={Number(r.minimum)}
                          maximum={Number(r.maximum)}
                          choix={
                            r.groupe === "section"
                              ? [
                                  { valeur: "1", libelle: "Affichée" },
                                  { valeur: "0", libelle: "Cachée" },
                                ]
                              : undefined
                          }
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[13px] text-adm-secondaire tabular-nums">
                        {r.groupe === "section" ? "" : `${formaterNombre(Number(r.minimum))} à ${formaterNombre(Number(r.maximum))}`}
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
      ))}
    </>
  );
}
