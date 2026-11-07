import { Suspense } from "react";
import Link from "next/link";
import { EnTetePage, Pastille, Section, Vide } from "@/components/admin/ui";
import { ActionConfirmee, BoutonAction } from "@/components/admin/Actions";
import { changerStatutCurateur, traiterCandidature } from "@/app/actions/admin";
import { exigerAdmin } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { lireReglages } from "@/lib/reglages";
import { LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";
import { formaterDate } from "@/lib/format";

export default function PageCurateurs() {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Curateurs />
    </Suspense>
  );
}

// Candidatures, période d'essai (décisions validées par un admin), puis autonomie dans le thème
async function Curateurs() {
  await exigerAdmin();
  const supabase = await creerClientServeur();
  const [{ data: candidatures }, { data: curateurs }, { count: decisions }, reglages] = await Promise.all([
    supabase
      .from("candidatures_curateur")
      .select("id, categorie, motivation, cree_le, candidat:utilisateurs!candidatures_curateur_utilisateur_id_fkey(id, nom_utilisateur)")
      .eq("statut", "en_attente")
      .order("cree_le")
      .returns<{ id: number; categorie: Categorie; motivation: string; cree_le: string; candidat: { id: string; nom_utilisateur: string } | null }[]>(),
    supabase
      .from("curateurs")
      .select("utilisateur_id, categorie, statut, decisions_validees, cree_le, curateur:utilisateurs!curateurs_utilisateur_id_fkey(nom_utilisateur)")
      .order("cree_le")
      .returns<{ utilisateur_id: string; categorie: Categorie; statut: string; decisions_validees: number; cree_le: string; curateur: { nom_utilisateur: string } | null }[]>(),
    supabase.from("decisions_curateur").select("id", { count: "exact", head: true }).eq("statut", "a_valider"),
    lireReglages(),
  ]);
  const seuil = Number(reglages.seuil_essai_curateur);

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre="Curateurs"
        description={`Candidature → période d'essai (chaque décision est validée par un admin) → autonome après ${seuil} décisions validées. Les admins gardent le dernier mot.`}
      />
      {(decisions ?? 0) > 0 && (
        <p className="rounded-md border border-[#eedfb8] bg-[#fbf4e4] px-3 py-2 text-[13px]">
          {decisions} décision(s) de curateurs à valider dans la{" "}
          <Link href="/admin/approbation" className="font-semibold underline">
            file d&apos;approbation
          </Link>
          .
        </p>
      )}

      <Section titre={`Candidatures en attente (${(candidatures ?? []).length})`} className="[&>div:last-child]:p-0">
        {(candidatures ?? []).length === 0 && <Vide>Aucune candidature en attente.</Vide>}
        {(candidatures ?? []).map((c) => (
          <article key={c.id} className="flex flex-col gap-2 border-b border-adm-bordure px-4 py-3 last:border-b-0">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <Link href={`/admin/utilisateurs/${c.candidat?.id}`} className="font-semibold text-adm-accent hover:underline">
                @{c.candidat?.nom_utilisateur}
              </Link>
              <Pastille>{LIBELLES_CATEGORIES[c.categorie]}</Pastille>
              <span className="text-adm-secondaire">{formaterDate(c.cree_le)}</span>
            </div>
            <p className="text-sm">« {c.motivation} »</p>
            <div className="flex flex-wrap gap-2">
              <BoutonAction action={traiterCandidature.bind(null, c.id, true)} libelle="Accepter (période d'essai)" variante="principal" />
              <ActionConfirmee
                action={traiterCandidature.bind(null, c.id, false)}
                libelle="Refuser"
                titre="Refuser cette candidature ?"
                message={`@${c.candidat?.nom_utilisateur} pourra postuler de nouveau plus tard.`}
                confirmer="Refuser"
              />
            </div>
          </article>
        ))}
      </Section>

      <Section titre="Curateurs" className="[&>div:last-child]:p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-adm-zone text-left text-[13px]">
              <tr>
                {["Curateur", "Thème", "Statut", "Décisions validées", "Depuis", ""].map((t) => (
                  <th key={t} scope="col" className="border-b border-adm-bordure px-3 py-2 font-semibold">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(curateurs ?? []).map((c) => (
                <tr key={`${c.utilisateur_id}-${c.categorie}`} className="border-b border-adm-bordure last:border-b-0">
                  <td className="px-3 py-2">
                    <Link href={`/admin/utilisateurs/${c.utilisateur_id}`} className="text-adm-accent hover:underline">
                      @{c.curateur?.nom_utilisateur}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{LIBELLES_CATEGORIES[c.categorie]}</td>
                  <td className="px-3 py-2">{c.statut === "autonome" ? <Pastille ton="accent">Autonome</Pastille> : <Pastille ton="attention">Essai</Pastille>}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {c.decisions_validees} / {seuil}
                  </td>
                  <td className="px-3 py-2">{formaterDate(c.cree_le)}</td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1.5">
                      {c.statut === "essai" ? (
                        <BoutonAction action={changerStatutCurateur.bind(null, c.utilisateur_id, c.categorie, "autonome")} libelle="Rendre autonome" />
                      ) : (
                        <BoutonAction action={changerStatutCurateur.bind(null, c.utilisateur_id, c.categorie, "essai")} libelle="Remettre en essai" />
                      )}
                      <ActionConfirmee
                        action={changerStatutCurateur.bind(null, c.utilisateur_id, c.categorie, "retirer")}
                        libelle="Retirer"
                        titre="Retirer ce curateur ?"
                        message={`@${c.curateur?.nom_utilisateur} perdra son badge et ses droits dans le thème ${LIBELLES_CATEGORIES[c.categorie]}.`}
                        confirmer="Retirer"
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(curateurs ?? []).length === 0 && <Vide>Aucun curateur pour l&apos;instant.</Vide>}
        </div>
      </Section>
    </div>
  );
}
