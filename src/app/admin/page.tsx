import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CarteApprobation, type QuestionEnAttente } from "@/components/admin/CarteApprobation";
import { FormulaireMotDePasse } from "@/components/admin/Formulaires";
import { BoutonAction } from "@/components/admin/BoutonAction";
import { marquerCadeauEnvoye } from "@/app/actions/admin";
import { exigerAcces } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { heuresDepuis, masquerTelephone, partiesKinshasa } from "@/lib/format";
import type { Categorie } from "@/lib/marches/categories";

// File d'approbation (maquettes/Admin.dc.html). Objectif : chaque question examinée sous 12 à 24 h.
export default function PageFileApprobation() {
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-carte bg-doux" />}>
      <FileApprobation />
    </Suspense>
  );
}

type Ligne = {
  id: number;
  question: string;
  categorie: Categorie;
  source: string;
  date_fin: string;
  cree_le: string;
  auteur: { nom_utilisateur: string } | null;
};

type Decision = {
  id: number;
  marche_id: number;
  decision: "approuve" | "refuse";
  motif: string | null;
  curateur: { nom_utilisateur: string } | null;
};

const dateFin = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kinshasa" });

async function FileApprobation() {
  const acces = await exigerAcces();
  const t = await getTranslations("admin");
  const supabase = await creerClientServeur();

  // La RLS limite déjà un curateur aux questions de ses thèmes
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
      ...l,
      auteur: l.auteur?.nom_utilisateur ?? null,
      ageHeures: heuresDepuis(l.cree_le),
      finLibelle: dateFin.format(new Date(l.date_fin)),
      dateFinJour: jour,
      dateFinHeure: heure,
      decision: d ? { id: d.id, decision: d.decision, motif: d.motif, curateur: d.curateur?.nom_utilisateur ?? "?" } : null,
    };
  });

  const s = stats as { en_attente: number; au_dela_12h: number; delai_moyen_h: number | null; a_regler: number } | null;
  const enRetard = file.filter((q) => q.ageHeures >= 12).length;
  const tuiles = [
    { valeur: String(file.length), libelle: t("tuileEnAttente"), style: "bg-vert-jaune text-foret" },
    ...(s ? [{ valeur: s.delai_moyen_h === null ? "—" : `${s.delai_moyen_h} h`, libelle: t("tuileDelai"), style: "bg-white text-foret" }] : []),
    { valeur: String(enRetard), libelle: t("tuileRetard"), style: "bg-brique text-white" },
    ...(s ? [{ valeur: String(s.a_regler), libelle: t("tuileARegler"), style: "bg-white text-foret" }] : []),
  ];

  const statutTheme = (c: Categorie) => acces.themes.find((x) => x.categorie === c)?.statut;

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <main className="flex min-w-0 flex-1 flex-col gap-[22px]">
        <div>
          <h1 className="text-[32px] tracking-[-1px] md:text-4xl">{t("fileTitre")}</h1>
          <p className="mt-1.5 text-[15px] text-texte-secondaire">{t("fileObjectif")}</p>
          {!acces.admin && (
            <p className="mt-2 rounded-bouton bg-doux p-3 text-sm">
              {acces.themes.map((th) => t(th.statut === "essai" ? "themeEssai" : "themeAutonome", { theme: t(`categories.${th.categorie}`), n: th.decisions_validees })).join(" · ")}
            </p>
          )}
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
          {tuiles.map((x) => (
            <div key={x.libelle} className={`rounded-[18px] border-2 border-foret p-[18px] shadow-foret ${x.style}`}>
              <div className="font-titre text-[34px] font-bold">{x.valeur}</div>
              <div className="mt-0.5 text-[13px] font-semibold">{x.libelle}</div>
            </div>
          ))}
        </div>

        {file.length === 0 ? (
          <div className="rounded-carte border-2 border-dashed border-sauge p-8 text-center font-bold">{t("fileVide")}</div>
        ) : (
          file.map((q) => <CarteApprobation key={q.id} q={q} admin={acces.admin} essai={!acces.admin && statutTheme(q.categorie) === "essai"} />)
        )}
      </main>

      {acces.admin && (
        <aside className="flex min-w-0 flex-col gap-5 xl:w-[340px] xl:flex-none">
          <FormulaireMotDePasse />
          <Suspense fallback={null}>
            <CadeauxAEnvoyer />
          </Suspense>
        </aside>
      )}
    </div>
  );
}

// Résumé « Cadeaux à envoyer » (colonne de droite)
async function CadeauxAEnvoyer() {
  const t = await getTranslations("admin");
  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("cadeaux")
    .select("id, type, utilisateur_id, gagnant:utilisateurs!cadeaux_utilisateur_id_fkey(nom_utilisateur)")
    .eq("statut", "a_envoyer")
    .order("cree_le")
    .limit(5)
    .returns<{ id: number; type: string; utilisateur_id: string; gagnant: { nom_utilisateur: string } | null }[]>();
  const ids = (data ?? []).map((c) => c.utilisateur_id);
  const { data: coords } = ids.length
    ? await supabase.from("coordonnees_utilisateurs").select("utilisateur_id, telephone").in("utilisateur_id", ids)
    : { data: [] as { utilisateur_id: string; telephone: string | null }[] };

  return (
    <section className="rounded-carte border-2 border-foret bg-hunter p-5 text-white shadow-[6px_6px_0_#A7C957]">
      <h2 className="text-xl">{t("cadeauxAEnvoyer")}</h2>
      {(data ?? []).length === 0 ? (
        <p className="mt-2 text-sm text-[#E4EAD3]">{t("aucunCadeau")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {data!.map((c) => {
            const tel = coords?.find((x) => x.utilisateur_id === c.utilisateur_id)?.telephone ?? null;
            return (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-bouton bg-white px-3 py-2.5 text-sm text-foret">
                <span>
                  <strong>@{c.gagnant?.nom_utilisateur}</strong>
                  <br />
                  {tel ? `${t(`cadeauType.${c.type}`)} · ${masquerTelephone(tel)}` : t("numeroManquant")}
                </span>
                {tel ? (
                  <BoutonAction action={marquerCadeauEnvoye.bind(null, c.id)} libelle={t("envoye")} variante="oui" petit />
                ) : (
                  <span className="rounded-full bg-brique px-2 py-1 text-[11px] font-bold text-white">{t("enAttente")}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/admin/cadeaux" className="mt-3 inline-block text-sm font-bold underline">
        {t("toutLesCadeaux")}
      </Link>
    </section>
  );
}
