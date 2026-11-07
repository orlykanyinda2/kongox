import { Suspense } from "react";
import { Chiffre, EnTetePage, Section, Vide } from "@/components/admin/ui";
import { LigneApprobation, type QuestionEnAttente } from "@/components/admin/Approbation";
import { exigerAcces } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate, heuresDepuis, partiesKinshasa } from "@/lib/format";
import { LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";

export default function PageApprobation() {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <FileApprobation />
    </Suspense>
  );
}

type Ligne = { id: number; question: string; categorie: Categorie; source: string; date_fin: string; cree_le: string; auteur: { nom_utilisateur: string } | null };
type Decision = { id: number; marche_id: number; decision: "approuve" | "refuse"; motif: string | null; curateur: { nom_utilisateur: string } | null };

// File d'approbation : questions proposées par la communauté, à examiner sous 12 à 24 h.
async function FileApprobation() {
  const acces = await exigerAcces();
  const supabase = await creerClientServeur();
  const [{ data: lignes }, { data: decisions }, { data: stats }] = await Promise.all([
    supabase
      .from("marches")
      .select("id, question, categorie, source, date_fin, cree_le, auteur:utilisateurs!marches_auteur_id_fkey(nom_utilisateur)")
      .eq("statut", "en_attente")
      .order("cree_le", { ascending: true })
      .returns<Ligne[]>(),
    supabase
      .from("decisions_curateur")
      .select("id, marche_id, decision, motif, curateur:utilisateurs!decisions_curateur_curateur_id_fkey(nom_utilisateur)")
      .eq("statut", "a_valider")
      .returns<Decision[]>(),
    acces.admin ? supabase.rpc("statistiques_admin") : Promise.resolve({ data: null }),
  ]);

  const file: QuestionEnAttente[] = (lignes ?? []).map((l) => {
    const d = (decisions ?? []).find((x) => x.marche_id === l.id);
    const { jour, heure } = partiesKinshasa(l.date_fin);
    return {
      id: l.id,
      question: l.question,
      categorie: l.categorie,
      source: l.source,
      auteur: l.auteur?.nom_utilisateur ?? null,
      ageHeures: heuresDepuis(l.cree_le),
      finLibelle: formaterDate(l.date_fin),
      dateFinJour: jour,
      dateFinHeure: heure,
      decision: d ? { id: d.id, decision: d.decision, motif: d.motif, curateur: d.curateur?.nom_utilisateur ?? "?" } : null,
    };
  });
  const s = stats as { delai_moyen_h: number | null } | null;
  const statut = (c: Categorie) => acces.themes.find((t) => t.categorie === c)?.statut;

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre="File d'approbation"
        description={
          acces.admin
            ? "Objectif : chaque question examinée sous 12 à 24 h. Les plus anciennes en premier."
            : `Tes thèmes : ${acces.themes.map((t) => `${LIBELLES_CATEGORIES[t.categorie]} (${t.statut === "essai" ? `essai ${t.decisions_validees} décisions validées` : "autonome"})`).join(", ")}.`
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Chiffre valeur={String(file.length)} libelle="En attente" />
        <Chiffre valeur={String(file.filter((q) => q.ageHeures >= 12).length)} libelle="Au-delà de 12 h" alerte={file.some((q) => q.ageHeures >= 12)} />
        {s && <Chiffre valeur={s.delai_moyen_h === null ? "—" : `${s.delai_moyen_h} h`} libelle="Délai moyen d'examen (30 j)" />}
        {acces.admin && <Chiffre valeur={String((decisions ?? []).length)} libelle="Décisions de curateurs à valider" />}
      </div>
      <Section titre="Questions en attente" className="[&>div:last-child]:p-0">
        {file.length === 0 ? (
          <Vide>Tout est à jour. Aucune question en attente.</Vide>
        ) : (
          file.map((q) => <LigneApprobation key={q.id} q={q} admin={acces.admin} essai={!acces.admin && statut(q.categorie) === "essai"} />)
        )}
      </Section>
    </div>
  );
}
