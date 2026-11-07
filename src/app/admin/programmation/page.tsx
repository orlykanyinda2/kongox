import { Suspense } from "react";
import Link from "next/link";
import { EnTetePage, Pastille, Section, StatutMarche, cls } from "@/components/admin/ui";
import { BoutonAction } from "@/components/admin/Actions";
import { FormulaireModele } from "@/components/admin/FormulaireModele";
import { activerModele } from "@/app/actions/backoffice";
import { exigerAdmin } from "@/lib/admin/acces";
import { valeur, type Params } from "@/lib/admin/tableau";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";
import { formaterDate } from "@/lib/format";

export default function PageProgrammation({ searchParams }: PageProps<"/admin/programmation">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Programmation searchParams={searchParams} />
    </Suspense>
  );
}

type Marche = { id: number; question: string; categorie: Categorie; statut: string; date_publication: string | null; date_fin: string; soki_programme: boolean; modele_id: number | null };
type Modele = {
  id: number;
  question_modele: string;
  categorie: Categorie;
  frequence: string;
  jour_semaine: number | null;
  heure_publication: string;
  duree_heures: number;
  soki: boolean;
  actif: boolean;
  prochaine_publication: string;
};

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const MOIS = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const jourKin = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kinshasa" }).format(new Date(iso));
const heureKin = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Kinshasa", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

async function Programmation({ searchParams }: { searchParams: Promise<Params> }) {
  await exigerAdmin();
  const params = await searchParams;
  const vue = valeur(params, "vue") === "calendrier" ? "calendrier" : "liste";
  const aujourdhui = jourKin(new Date().toISOString());
  const mois = /^\d{4}-\d{2}$/.test(valeur(params, "mois")) ? valeur(params, "mois") : aujourdhui.slice(0, 7);
  const [annee, m] = mois.split("-").map(Number);
  const debutMois = new Date(Date.UTC(annee, m - 1, 1));
  const finMois = new Date(Date.UTC(annee, m, 1));
  const precedent = new Date(Date.UTC(annee, m - 2, 1)).toISOString().slice(0, 7);
  const suivant = new Date(Date.UTC(annee, m, 1)).toISOString().slice(0, 7);

  const supabase = await creerClientServeur();
  const champs = "id, question, categorie, statut, date_publication, date_fin, soki_programme, modele_id";
  const [{ data: programmes }, { data: duMois }, { data: modeles }] = await Promise.all([
    supabase.from("marches").select(champs).in("statut", ["programme", "brouillon"]).order("date_publication", { ascending: true, nullsFirst: false }).limit(200).returns<Marche[]>(),
    supabase
      .from("marches")
      .select(champs)
      .in("statut", ["programme", "approuve", "ferme", "regle"])
      .gte("date_publication", new Date(debutMois.getTime() - 3_600_000).toISOString())
      .lt("date_publication", finMois.toISOString())
      .order("date_publication")
      .returns<Marche[]>(),
    supabase.from("modeles_recurrents").select("*").order("cree_le", { ascending: false }).returns<Modele[]>(),
  ]);

  // Grille du mois : semaines du lundi au dimanche
  const premierJour = (debutMois.getUTCDay() + 6) % 7; // 0 = lundi
  const nbJours = new Date(Date.UTC(annee, m, 0)).getUTCDate();
  const cases: (string | null)[] = [...Array(premierJour).fill(null), ...Array.from({ length: nbJours }, (_, i) => `${mois}-${String(i + 1).padStart(2, "0")}`)];
  while (cases.length % 7) cases.push(null);

  const onglet = (v: string, libelle: string) => (
    <Link
      href={`/admin/programmation?vue=${v}${v === "calendrier" ? `&mois=${mois}` : ""}`}
      aria-current={vue === v ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-[13px] ${vue === v ? "bg-adm-accent font-semibold text-white" : "border border-adm-bordure hover:bg-adm-zone"}`}
    >
      {libelle}
    </Link>
  );

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre="Programmation"
        description="Brouillon → programmé → en ligne → fermé → réglé. Les marchés programmés sont publiés automatiquement à l'heure prévue (vérification chaque minute)."
        actions={
          <Link href="/admin/marches/nouveau" className={cls.principal}>
            Nouveau marché
          </Link>
        }
      />
      <div className="flex gap-1.5">
        {onglet("liste", "Liste")}
        {onglet("calendrier", "Calendrier")}
      </div>

      {vue === "liste" ? (
        <Section titre="Brouillons et marchés programmés">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-adm-zone text-left text-[13px]">
                <tr>
                  {["Publication", "Question", "Statut", "Fermeture", ""].map((t) => (
                    <th key={t} scope="col" className="border-b border-adm-bordure px-3 py-2 font-semibold">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(programmes ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-adm-bordure last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-2">{p.date_publication ? formaterDate(p.date_publication) : "—"}</td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/marches/${p.id}`} className="text-adm-accent hover:underline">
                        {p.question}
                      </Link>
                      <span className="ml-1.5 inline-flex gap-1">
                        {p.soki_programme && <Pastille ton="danger">Soki</Pastille>}
                        {p.modele_id && <Pastille>Récurrent</Pastille>}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <StatutMarche statut={p.statut} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{formaterDate(p.date_fin)}</td>
                    <td className="px-3 py-2 text-[13px] text-adm-secondaire">{LIBELLES_CATEGORIES[p.categorie]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(programmes ?? []).length === 0 && <p className="py-6 text-center text-sm text-adm-secondaire">Aucun brouillon ni marché programmé.</p>}
          </div>
        </Section>
      ) : (
        <Section
          titre={MOIS.format(debutMois)}
          actions={
            <div className="flex gap-1.5 text-[13px]">
              <Link href={`/admin/programmation?vue=calendrier&mois=${precedent}`} className="rounded-md border border-adm-bordure px-2.5 py-1 hover:bg-adm-zone">
                ← Mois précédent
              </Link>
              <Link href={`/admin/programmation?vue=calendrier&mois=${suivant}`} className="rounded-md border border-adm-bordure px-2.5 py-1 hover:bg-adm-zone">
                Mois suivant →
              </Link>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <div className="grid min-w-[720px] grid-cols-7 border-l border-t border-adm-bordure text-[12px]">
              {JOURS.map((j) => (
                <div key={j} className="border-b border-r border-adm-bordure bg-adm-zone px-2 py-1 font-semibold capitalize">
                  {j}
                </div>
              ))}
              {cases.map((jour, i) => {
                const contenu = jour ? (duMois ?? []).filter((x) => x.date_publication && jourKin(x.date_publication) === jour) : [];
                return (
                  <div key={i} className={`min-h-24 border-b border-r border-adm-bordure p-1.5 ${jour === aujourdhui ? "bg-[#f1f6ee]" : ""}`}>
                    {jour && <div className={`mb-1 text-right ${jour === aujourdhui ? "font-bold text-adm-accent" : "text-adm-secondaire"}`}>{Number(jour.slice(8))}</div>}
                    <ul className="flex flex-col gap-1">
                      {contenu.map((x) => (
                        <li key={x.id}>
                          <Link
                            href={`/admin/marches/${x.id}`}
                            title={x.question}
                            className={`block truncate rounded px-1 py-0.5 ${x.statut === "programme" ? "bg-[#fbf4e4]" : "bg-adm-zone"} hover:underline`}
                          >
                            {heureKin(x.date_publication!)} {x.soki_programme ? "★ " : ""}
                            {x.question}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-xs text-adm-secondaire">Fond jaune : programmé · fond gris : déjà publié · ★ : Soki du jour.</p>
        </Section>
      )}

      <Section titre="Marchés récurrents">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-adm-zone text-left text-[13px]">
              <tr>
                {["Question (modèle)", "Fréquence", "Ouverture", "Prochaine publication", "État", ""].map((t) => (
                  <th key={t} scope="col" className="border-b border-adm-bordure px-3 py-2 font-semibold">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(modeles ?? []).map((md) => (
                <tr key={md.id} className="border-b border-adm-bordure last:border-b-0">
                  <td className="px-3 py-2">
                    {md.question_modele} {md.soki && <Pastille ton="danger">Soki</Pastille>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {md.frequence === "quotidienne" ? "Chaque jour" : `Chaque ${JOURS[(md.jour_semaine ?? 1) - 1]}`} à {md.heure_publication.slice(0, 5)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{md.duree_heures} h</td>
                  <td className="whitespace-nowrap px-3 py-2">{md.actif ? formaterDate(md.prochaine_publication) : "—"}</td>
                  <td className="px-3 py-2">{md.actif ? <Pastille ton="accent">Actif</Pastille> : <Pastille>En pause</Pastille>}</td>
                  <td className="px-3 py-2">
                    <BoutonAction action={activerModele.bind(null, md.id, !md.actif)} libelle={md.actif ? "Mettre en pause" : "Activer"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(modeles ?? []).length === 0 && <p className="py-6 text-center text-sm text-adm-secondaire">Aucun modèle pour l’instant.</p>}
        </div>
        <details className="mt-4 rounded-md border border-adm-bordure">
          <summary className="cursor-pointer bg-adm-zone px-3 py-2 text-[13px] font-semibold">Nouveau modèle récurrent</summary>
          <div className="p-3">
            <FormulaireModele />
            <p className="mt-3 text-xs text-adm-secondaire">
              Les marchés de chaque modèle sont créés 24 h à l’avance en « programmé » : tu peux encore les modifier ou les repasser en brouillon. Un
              marché pour chaque match d’un championnat arrive avec l’import des matchs (étape 4).
            </p>
          </div>
        </details>
      </Section>
    </div>
  );
}
