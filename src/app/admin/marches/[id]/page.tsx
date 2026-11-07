import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnTetePage, Pastille, Section, StatutMarche } from "@/components/admin/ui";
import { FormulaireMarche } from "@/components/admin/FormulaireMarche";
import { FormulaireSponsor } from "@/components/admin/FormulaireSponsor";
import { ActionConfirmee, BoutonAction } from "@/components/admin/Actions";
import { changerEtatMarche, dupliquerMarche, fermerMarche, mettreEnAvant, supprimerMarche } from "@/app/actions/backoffice";
import { definirSoki } from "@/app/actions/admin";
import { exigerAdmin } from "@/lib/admin/acces";
import { libelleAction } from "@/lib/admin/libelles";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";
import { formaterDate, formaterNombre, partiesKinshasa } from "@/lib/format";

export default function PageMarcheAdmin({ params }: PageProps<"/admin/marches/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <FicheMarche params={params} />
    </Suspense>
  );
}

type Marche = {
  id: number;
  question: string;
  categorie: Categorie;
  source: string;
  statut: string;
  date_publication: string | null;
  date_fin: string;
  soki_du_jour: boolean;
  soki_programme: boolean;
  mis_en_avant: boolean;
  sponsor: string | null;
  motif: string | null;
  cree_le: string;
  auteur: { nom_utilisateur: string } | null;
  options: { id: number; libelle: string; ordre: number; total_mise: number }[];
};

async function FicheMarche({ params }: { params: Promise<{ id: string }> }) {
  await exigerAdmin();
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  const supabase = await creerClientServeur();

  const [{ data: m }, { data: mises }, { data: journal }] = await Promise.all([
    supabase
      .from("marches")
      .select(
        "id, question, categorie, source, statut, date_publication, date_fin, soki_du_jour, soki_programme, mis_en_avant, sponsor, motif, cree_le, " +
          "auteur:utilisateurs!marches_auteur_id_fkey(nom_utilisateur), options:options_marche!options_marche_marche_id_fkey(id, libelle, ordre, total_mise)",
      )
      .eq("id", n)
      .maybeSingle<Marche>(),
    supabase.rpc("mises_en_cours", { p_marche: n }),
    supabase
      .from("journal_admin")
      .select("id, action, cree_le, auteur:utilisateurs!journal_admin_auteur_id_fkey(nom_utilisateur)")
      .eq("cible_marche", n)
      .order("cree_le", { ascending: false })
      .limit(10)
      .returns<{ id: number; action: string; cree_le: string; auteur: { nom_utilisateur: string } | null }[]>(),
  ]);
  if (!m) notFound();

  const enCours = (mises ?? { mises: 0, pieces: 0 }) as { mises: number; pieces: number };
  // toutes-les-predictions : volontaire (admin : nombre de mises du marché, tous joueurs)
  const { count: totalMises } = await supabase.from("predictions").select("id", { count: "exact", head: true }).eq("marche_id", n);
  const verrouille = (totalMises ?? 0) > 0;
  const fin = partiesKinshasa(m.date_fin);
  const pub = m.date_publication ? partiesKinshasa(m.date_publication) : { jour: "", heure: "" };
  const options = [...m.options].sort((a, b) => a.ordre - b.ordre);
  const total = options.reduce((s, o) => s + o.total_mise, 0);
  const modifiable = !["regle", "supprime", "refuse"].includes(m.statut);

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre={`Marché n° ${m.id}`}
        description={m.question}
        actions={
          <>
            <Link href="/admin/marches" className="text-[13px] text-adm-secondaire underline">
              ← Tous les marchés
            </Link>
            {["approuve", "ferme", "regle"].includes(m.statut) && (
              <Link href={`/marches/${m.id}`} className="text-[13px] text-adm-accent underline">
                Voir sur le site
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <StatutMarche statut={m.statut} />
        {m.soki_du_jour && <Pastille ton="danger">Soki du jour</Pastille>}
        {m.mis_en_avant && <Pastille ton="accent">Mis en avant</Pastille>}
        <span className="text-adm-secondaire">
          {LIBELLES_CATEGORIES[m.categorie]} · créé le {formaterDate(m.cree_le)}
          {m.auteur && <> · proposé par @{m.auteur.nom_utilisateur}</>}
          {m.date_publication && <> · publication {formaterDate(m.date_publication)}</>} · fermeture {formaterDate(m.date_fin)}
        </span>
      </div>
      {m.motif && <p className="text-[13px]">Motif : {m.motif}</p>}

      <Section titre="Actions">
        <div className="flex flex-wrap items-start gap-2">
          {["brouillon", "programme"].includes(m.statut) && (
            <BoutonAction action={changerEtatMarche.bind(null, m.id, "publier")} libelle="Publier maintenant" variante="principal" />
          )}
          {m.statut === "brouillon" && <BoutonAction action={changerEtatMarche.bind(null, m.id, "programmer")} libelle="Programmer" />}
          {m.statut === "programme" && <BoutonAction action={changerEtatMarche.bind(null, m.id, "brouillon")} libelle="Repasser en brouillon" />}
          {m.statut === "approuve" && !m.soki_du_jour && <BoutonAction action={definirSoki.bind(null, m.id)} libelle="Mettre en Soki du jour" />}
          {modifiable && (
            <BoutonAction action={mettreEnAvant.bind(null, m.id, !m.mis_en_avant)} libelle={m.mis_en_avant ? "Retirer de la mise en avant" : "Mettre en avant"} />
          )}
          <BoutonAction action={dupliquerMarche.bind(null, m.id)} libelle="Dupliquer" />
          {(m.statut === "ferme" || m.statut === "approuve") && (
            <Link href="/admin/resultats" className="inline-flex h-9 items-center rounded-md border border-adm-bordure px-3.5 text-sm font-semibold hover:bg-adm-zone">
              Régler le résultat
            </Link>
          )}
          {m.statut === "approuve" && (
            <ActionConfirmee
              action={fermerMarche.bind(null, m.id)}
              libelle="Fermer les mises"
              titre="Fermer les mises maintenant ?"
              message="Plus personne ne pourra miser. Le marché passera dans « Résultats à régler »."
              confirmer="Fermer les mises"
            />
          )}
          {m.statut !== "regle" && m.statut !== "supprime" && (
            <ActionConfirmee
              action={supprimerMarche.bind(null, m.id)}
              libelle="Supprimer"
              variante="danger"
              titre="Supprimer ce marché ?"
              message={
                enCours.mises > 0
                  ? `${formaterNombre(enCours.mises)} mise(s) en cours (${formaterNombre(enCours.pieces)} pièces) seront remboursées automatiquement. Le marché disparaîtra du site.`
                  : "Aucune mise en cours. Le marché disparaîtra du site."
              }
              confirmer="Supprimer et rembourser"
              champs={[{ nom: "motif", libelle: "Motif (obligatoire)", requis: true }]}
            />
          )}
        </div>
      </Section>

      {m.statut !== "supprime" && (
        <Section titre="Sponsor">
          <FormulaireSponsor marche={m.id} sponsor={m.sponsor} />
        </Section>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Section titre={modifiable ? "Modifier" : "Contenu"}>
          {modifiable ? (
            <FormulaireMarche
              mode="modification"
              marche={m.id}
              statut={m.statut}
              verrouille={verrouille}
              valeurs={{
                question: m.question,
                categorie: m.categorie,
                source: m.source,
                finDate: fin.jour,
                finHeure: fin.heure,
                pubDate: pub.jour,
                pubHeure: pub.heure,
                misEnAvant: m.mis_en_avant,
                soki: m.soki_programme,
              }}
            />
          ) : (
            <p className="text-sm">
              {m.question}
              <br />
              <span className="text-adm-secondaire">Source : {m.source}</span>
            </p>
          )}
        </Section>

        <div className="flex flex-col gap-5">
          <Section titre="Cagnotte">
            <table className="w-full text-sm">
              <tbody>
                {options.map((o) => (
                  <tr key={o.id} className="border-b border-adm-bordure last:border-b-0">
                    <td className="py-1.5 font-medium">{o.libelle}</td>
                    <td className="py-1.5 text-right tabular-nums">{formaterNombre(o.total_mise)}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums text-adm-secondaire">{total ? Math.round((o.total_mise * 100) / total) : 50} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[13px] text-adm-secondaire">
              {formaterNombre(totalMises ?? 0)} mise(s) au total · {formaterNombre(enCours.mises)} en cours
            </p>
          </Section>
          <Section titre="Historique">
            <ul className="flex flex-col gap-1.5 text-[13px]">
              {(journal ?? []).map((j) => (
                <li key={j.id}>
                  <span className="text-adm-secondaire">{formaterDate(j.cree_le)}</span> · {libelleAction(j.action)}
                  {j.auteur && <> · @{j.auteur.nom_utilisateur}</>}
                </li>
              ))}
              {(journal ?? []).length === 0 && <li className="text-adm-secondaire">Aucune action.</li>}
            </ul>
            <Link href={`/admin/journal?marche=${m.id}`} className="mt-2 inline-block text-[13px] text-adm-accent underline">
              Tout le journal de ce marché
            </Link>
          </Section>
        </div>
      </div>
    </div>
  );
}
