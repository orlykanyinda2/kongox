import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Chiffre, EnTetePage, Section } from "@/components/admin/ui";
import { GraphiqueSerie } from "@/components/admin/GraphiqueSerie";
import { exigerAcces } from "@/lib/admin/acces";
import { valeur, type Params } from "@/lib/admin/tableau";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate, formaterNombre } from "@/lib/format";
import { lireReglages } from "@/lib/reglages";

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
  const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kinshasa" }).format(new Date());
  const [{ data: jour }, { data: serie }, { data: appels }, { data: dernierImport }, reglages] = await Promise.all([
    supabase.rpc("tableau_de_bord"),
    supabase.rpc("series_tableau_de_bord", { p_jours: periode.jours }),
    supabase.from("appels_api").select("nombre").eq("jour", aujourdhui).eq("fournisseur", "api_football").maybeSingle(),
    supabase.from("imports_football").select("debut, type, statut").order("debut", { ascending: false }).limit(1).maybeSingle(),
    lireReglages(),
  ]);
  const { data: ia } = await supabase.from("ia_usage_jour").select("*").eq("jour", aujourdhui).maybeSingle();
  const limiteApi = Number(reglages.api_football_limite_jour);
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Chiffre
          valeur={`${appels?.nombre ?? 0} / ${limiteApi}`}
          libelle="Requêtes API-Football aujourd'hui"
          lien="/admin/matchs"
          alerte={(appels?.nombre ?? 0) >= limiteApi}
        />
      </div>
      <Section titre="Assistant IA aujourd'hui">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Chiffre
            valeur={`${formaterNombre(ia?.questions ?? 0)} / ${formaterNombre(Number(reglages.ia_plafond_global_jour))}`}
            libelle="Questions (plafond global)"
            alerte={(ia?.questions ?? 0) >= Number(reglages.ia_plafond_global_jour)}
          />
          <Chiffre valeur={formaterNombre(ia?.requetes ?? 0)} libelle="Requêtes réussies" />
          <Chiffre valeur={formaterNombre(ia?.erreurs ?? 0)} libelle="Erreurs (questions rendues)" alerte={(ia?.erreurs ?? 0) > 0} />
          <Chiffre valeur={formaterNombre(ia?.jetons_entree ?? 0)} libelle="Jetons en entrée" />
          <Chiffre valeur={formaterNombre(ia?.jetons_sortie ?? 0)} libelle="Jetons en sortie" />
          <Chiffre valeur={formaterNombre(ia?.jetons_cache_lus ?? 0)} libelle={`Jetons lus en cache (${formaterNombre(ia?.jetons_cache_ecrits ?? 0)} écrits)`} />
        </div>
        <p className="mt-2 text-xs text-adm-secondaire">
          Modèle : {String(reglages.ia_modele)} · {String(reglages.ia_questions_par_jour)} questions par personne et par jour · {Number(reglages.ia_active) ? "activé" : "désactivé"} (Réglages).
        </p>
      </Section>
      <IndicateursFil jours={periode.jours ?? 3650} libelle={periode.libelle} />
      {dernierImport && (
        <p className="-mt-2 text-[13px] text-adm-secondaire">
          Dernier import : {dernierImport.type === "a_venir" ? "matchs à venir" : "résultats"}, {formaterDate(dernierImport.debut)} ({dernierImport.statut ?? "en cours"}).
        </p>
      )}
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

type Indicateurs = {
  sections: { section: string; affichages: number; clics: number; predictions: number; taux_clic: number }[];
  visites: number;
  predictions: number;
  retour: { j1_base: number; j1: number; j7_base: number; j7: number };
  minutes_premiere_prediction: number | null;
};

const NOMS_SECTIONS: Record<string, string> = {
  soki: "Soki du jour",
  pour_toi: "Pour toi",
  tendances: "Tendances",
  hausse: "En forte hausse",
  bientot: "Bientôt fermés",
  divise: "Le Congo est divisé",
  nouveaux: "Nouveaux",
  marches: "Page « Tous les marchés »",
};

const pourcent = (n: number, base: number) => (base > 0 ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format((100 * n) / base)} %` : "—");

// Mesure du fil (docs/ALGORITHME.md) : taux de clic par section, prédictions par visite, retour J1 / J7
async function IndicateursFil({ jours, libelle }: { jours: number; libelle: string }) {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc("indicateurs_fil", { p_jours: jours });
  if (error || !data) return null;
  const d = data as Indicateurs;
  const parVisite = d.visites > 0 ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(d.predictions / d.visites) : "—";
  return (
    <Section titre={`Fil de marchés — ${libelle}`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Chiffre valeur={formaterNombre(d.visites)} libelle="Visites" />
        <Chiffre valeur={parVisite} libelle={`Prédictions par visite (${formaterNombre(d.predictions)})`} />
        <Chiffre valeur={pourcent(d.retour.j1, d.retour.j1_base)} libelle={`Retour J1 (${formaterNombre(d.retour.j1)} / ${formaterNombre(d.retour.j1_base)})`} />
        <Chiffre valeur={pourcent(d.retour.j7, d.retour.j7_base)} libelle={`Retour J7 (${formaterNombre(d.retour.j7)} / ${formaterNombre(d.retour.j7_base)})`} />
        <Chiffre
          valeur={d.minutes_premiere_prediction === null ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number(d.minutes_premiere_prediction))} min`}
          libelle="Temps avant la 1re prédiction (médiane)"
        />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Taux de clic par section</caption>
          <thead className="bg-adm-zone text-left text-[13px]">
            <tr>
              {["Section", "Affichages", "Clics", "Taux de clic", "Prédictions"].map((t, i) => (
                <th key={t} scope="col" className={`border-b border-adm-bordure px-3 py-2 font-semibold ${i > 0 ? "text-right" : ""}`}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.sections.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-adm-secondaire">
                  Aucun événement sur la période.
                </td>
              </tr>
            ) : (
              d.sections.map((s) => (
                <tr key={s.section} className="border-b border-adm-bordure last:border-b-0">
                  <td className="px-3 py-2 font-medium">{NOMS_SECTIONS[s.section] ?? s.section}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formaterNombre(s.affichages)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formaterNombre(s.clics)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pourcent(s.clics, s.affichages)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formaterNombre(s.predictions)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-adm-secondaire">
        Visiteurs comptés avec un identifiant aléatoire du navigateur (sans données personnelles). Retour J1 / J7 : part des visiteurs revenus le lendemain / 7 jours après leur première visite. Événements gardés 180 jours.
      </p>
    </Section>
  );
}
