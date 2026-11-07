import { Suspense } from "react";
import Link from "next/link";
import { EnTetePage, cls } from "@/components/admin/ui";
import { ChampFiltre, Filtres, Tableau, type Colonne } from "@/components/admin/Tableau";
import { exigerAdmin } from "@/lib/admin/acces";
import { ACTIONS_JOURNAL, libelleAction } from "@/lib/admin/libelles";
import { lienAvec, lirePage, lireTri, valeur, type Params } from "@/lib/admin/tableau";
import { idParNomPublic } from "@/lib/admin/requetes";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate } from "@/lib/format";

export default function PageJournal({ searchParams }: PageProps<"/admin/journal">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Journal searchParams={searchParams} />
    </Suspense>
  );
}

type LigneJournal = {
  id: number;
  action: string;
  cree_le: string;
  avant: Record<string, unknown> | null;
  apres: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  cible_marche: number | null;
  auteur: { nom_utilisateur: string } | null;
  cible: { id: string; nom_utilisateur: string } | null;
};

function Valeurs({ titre, objet }: { titre: string; objet: Record<string, unknown> | null }) {
  if (!objet || Object.keys(objet).length === 0) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase text-adm-secondaire">{titre}</div>
      <dl className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-2 text-xs">
        {Object.entries(objet).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-adm-secondaire">{k}</dt>
            <dd className="break-all">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Journal : chaque action d'admin ou de curateur (qui, quoi, quand, avant / après)
async function Journal({ searchParams }: { searchParams: Promise<Params> }) {
  await exigerAdmin();
  const params = await searchParams;
  const { page, debut, fin } = lirePage(params);
  const { tri, croissant } = lireTri(params, ["cree_le"] as const, "cree_le");
  const action = valeur(params, "action");
  const auteur = valeur(params, "auteur").replace(/^@/, "");
  const utilisateur = valeur(params, "utilisateur").replace(/^@/, "");
  const marche = valeur(params, "marche");
  const du = valeur(params, "du");
  const au = valeur(params, "au");

  const supabase = await creerClientServeur();
  let requete = supabase
    .from("journal_admin")
    .select(
      "id, action, cree_le, avant, apres, details, cible_marche, auteur:utilisateurs!journal_admin_auteur_id_fkey(nom_utilisateur), cible:utilisateurs!journal_admin_cible_utilisateur_fkey(id, nom_utilisateur)",
      { count: "exact" },
    );
  if (action) requete = requete.eq("action", action);
  if (auteur) requete = requete.eq("auteur_id", (await idParNomPublic(auteur)) ?? "00000000-0000-0000-0000-000000000000");
  if (utilisateur) requete = requete.eq("cible_utilisateur", (await idParNomPublic(utilisateur)) ?? "00000000-0000-0000-0000-000000000000");
  if (/^\d+$/.test(marche)) requete = requete.eq("cible_marche", Number(marche));
  if (/^\d{4}-\d{2}-\d{2}$/.test(du)) requete = requete.gte("cree_le", `${du}T00:00:00+01:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(au)) requete = requete.lte("cree_le", `${au}T23:59:59+01:00`);
  const { data, count } = await requete.order(tri, { ascending: croissant }).range(debut, fin).returns<LigneJournal[]>();

  const colonnes: Colonne<LigneJournal>[] = [
    { cle: "date", titre: "Quand", tri: "cree_le", rendu: (j) => <span className="whitespace-nowrap">{formaterDate(j.cree_le)}</span> },
    { cle: "auteur", titre: "Qui", rendu: (j) => (j.auteur ? `@${j.auteur.nom_utilisateur}` : <span className="text-adm-secondaire">système</span>) },
    { cle: "action", titre: "Quoi", rendu: (j) => libelleAction(j.action) },
    {
      cle: "cible",
      titre: "Cible",
      rendu: (j) => (
        <span className="flex flex-col">
          {j.cible && (
            <Link href={`/admin/utilisateurs/${j.cible.id}`} className="text-adm-accent hover:underline">
              @{j.cible.nom_utilisateur}
            </Link>
          )}
          {j.cible_marche && (
            <Link href={`/admin/marches/${j.cible_marche}`} className="text-adm-accent hover:underline">
              marché n° {j.cible_marche}
            </Link>
          )}
        </span>
      ),
    },
    {
      cle: "details",
      titre: "Avant / après",
      rendu: (j) =>
        j.avant || j.apres || j.details ? (
          <details>
            <summary className="cursor-pointer text-[13px] text-adm-accent">Voir</summary>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
              <Valeurs titre="Avant" objet={j.avant} />
              <Valeurs titre="Après" objet={j.apres} />
              <Valeurs titre="Détails" objet={j.details} />
            </div>
          </details>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <EnTetePage titre="Journal" description="Toutes les actions des admins et des curateurs. Les actions automatiques (publication, fermeture) ne sont pas journalisées." />
      <Filtres chemin="/admin/journal" exportCsv={lienAvec("/admin/export/journal", params, { page: null })}>
        <ChampFiltre libelle="Action">
          <select name="action" defaultValue={action} className={cls.champ}>
            <option value="">Toutes</option>
            {Object.entries(ACTIONS_JOURNAL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </ChampFiltre>
        <ChampFiltre libelle="Par (admin, curateur)">
          <input name="auteur" defaultValue={auteur} autoCapitalize="none" className={cls.champ} />
        </ChampFiltre>
        <ChampFiltre libelle="Compte visé">
          <input name="utilisateur" defaultValue={utilisateur} autoCapitalize="none" className={cls.champ} />
        </ChampFiltre>
        <ChampFiltre libelle="Marché n°">
          <input name="marche" defaultValue={marche} inputMode="numeric" className={`${cls.champ} w-24`} />
        </ChampFiltre>
        <ChampFiltre libelle="Du">
          <input type="date" name="du" defaultValue={du} className={cls.champ} />
        </ChampFiltre>
        <ChampFiltre libelle="Au">
          <input type="date" name="au" defaultValue={au} className={cls.champ} />
        </ChampFiltre>
      </Filtres>
      <Tableau
        chemin="/admin/journal"
        params={params}
        colonnes={colonnes}
        lignes={data ?? []}
        cle={(j) => j.id}
        total={count ?? 0}
        page={page}
        tri={tri}
        croissant={croissant}
        vide="Aucune action ne correspond."
      />
    </div>
  );
}
