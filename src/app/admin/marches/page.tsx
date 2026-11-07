import { Suspense } from "react";
import Link from "next/link";
import { EnTetePage, Pastille, StatutMarche, STATUTS_MARCHE, cls } from "@/components/admin/ui";
import { ChampFiltre, Filtres, Tableau, type Colonne } from "@/components/admin/Tableau";
import { exigerAdmin } from "@/lib/admin/acces";
import { lienAvec, lirePage, lireTri, motifRecherche, valeur, PAR_PAGE, type Params } from "@/lib/admin/tableau";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { CATEGORIES, LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";
import { formaterDate, formaterNombre } from "@/lib/format";

export default function PageMarches({ searchParams }: PageProps<"/admin/marches">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Marches searchParams={searchParams} />
    </Suspense>
  );
}

type Ligne = {
  id: number;
  question: string;
  categorie: Categorie;
  statut: string;
  date_publication: string | null;
  date_fin: string;
  soki_du_jour: boolean;
  mis_en_avant: boolean;
  options: { total_mise: number }[];
};

const TRIS = ["id", "date_fin", "date_publication", "statut", "question"] as const;

async function Marches({ searchParams }: { searchParams: Promise<Params> }) {
  await exigerAdmin();
  const params = await searchParams;
  const { page, debut, fin } = lirePage(params);
  const { tri, croissant } = lireTri(params, TRIS, "id");
  const q = valeur(params, "q");
  const statut = valeur(params, "statut");
  const categorie = valeur(params, "categorie");

  const supabase = await creerClientServeur();
  let requete = supabase
    .from("marches")
    .select("id, question, categorie, statut, date_publication, date_fin, soki_du_jour, mis_en_avant, options:options_marche!options_marche_marche_id_fkey(total_mise)", { count: "exact" });
  if (q) requete = /^\d+$/.test(q) ? requete.eq("id", Number(q)) : requete.ilike("question", motifRecherche(q));
  if (statut) requete = requete.eq("statut", statut);
  else requete = requete.neq("statut", "supprime");
  if (categorie) requete = requete.eq("categorie", categorie);
  const { data, count } = await requete.order(tri, { ascending: croissant, nullsFirst: false }).range(debut, fin).returns<Ligne[]>();

  const colonnes: Colonne<Ligne>[] = [
    { cle: "id", titre: "N°", tri: "id", droite: true, rendu: (m) => m.id },
    {
      cle: "question",
      titre: "Question",
      tri: "question",
      rendu: (m) => (
        <span className="flex flex-col gap-1">
          <Link href={`/admin/marches/${m.id}`} className="font-medium text-adm-accent hover:underline">
            {m.question}
          </Link>
          <span className="flex gap-1">
            {m.soki_du_jour && <Pastille ton="danger">Soki du jour</Pastille>}
            {m.mis_en_avant && <Pastille ton="accent">Mis en avant</Pastille>}
          </span>
        </span>
      ),
    },
    { cle: "categorie", titre: "Catégorie", rendu: (m) => LIBELLES_CATEGORIES[m.categorie] },
    { cle: "statut", titre: "Statut", tri: "statut", rendu: (m) => <StatutMarche statut={m.statut} /> },
    { cle: "publication", titre: "Publication", tri: "date_publication", rendu: (m) => (m.date_publication ? formaterDate(m.date_publication) : "—") },
    { cle: "fin", titre: "Fermeture", tri: "date_fin", rendu: (m) => formaterDate(m.date_fin) },
    { cle: "mises", titre: "Pièces misées", droite: true, rendu: (m) => formaterNombre(m.options.reduce((s, o) => s + o.total_mise, 0)) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <EnTetePage
        titre="Marchés"
        description="Tous les marchés. L'admin crée, programme, modifie et supprime (avec remboursement automatique)."
        actions={
          <Link href="/admin/marches/nouveau" className={cls.principal}>
            Nouveau marché
          </Link>
        }
      />
      <Filtres chemin="/admin/marches" exportCsv={lienAvec("/admin/export/marches", params, { page: null })}>
        <ChampFiltre libelle="Recherche (texte ou n°)">
          <input name="q" defaultValue={q} className={cls.champ} />
        </ChampFiltre>
        <ChampFiltre libelle="Statut">
          <select name="statut" defaultValue={statut} className={cls.champ}>
            <option value="">Tous (sauf supprimés)</option>
            {Object.entries(STATUTS_MARCHE).map(([k, s]) => (
              <option key={k} value={k}>
                {s.libelle}
              </option>
            ))}
          </select>
        </ChampFiltre>
        <ChampFiltre libelle="Catégorie">
          <select name="categorie" defaultValue={categorie} className={cls.champ}>
            <option value="">Toutes</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {LIBELLES_CATEGORIES[c]}
              </option>
            ))}
          </select>
        </ChampFiltre>
      </Filtres>
      <Tableau
        chemin="/admin/marches"
        params={params}
        colonnes={colonnes}
        lignes={data ?? []}
        cle={(m) => m.id}
        total={count ?? 0}
        page={page}
        tri={tri}
        croissant={croissant}
        vide="Aucun marché ne correspond."
      />
      <p className="text-xs text-adm-secondaire">{PAR_PAGE} lignes par page. Dates à l’heure de Kinshasa.</p>
    </div>
  );
}
