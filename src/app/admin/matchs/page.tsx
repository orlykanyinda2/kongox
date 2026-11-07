import { Suspense } from "react";
import Link from "next/link";
import { Chiffre, EnTetePage, Pastille, Section, cls } from "@/components/admin/ui";
import { ChampFiltre, Filtres, Tableau, type Colonne } from "@/components/admin/Tableau";
import { ActionConfirmee, BoutonAction } from "@/components/admin/Actions";
import { activerLigue, corrigerMatch, importerMaintenant } from "@/app/actions/backoffice";
import { exigerAdmin } from "@/lib/admin/acces";
import { lirePage, lireTri, valeur, type Params } from "@/lib/admin/tableau";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { lireReglages } from "@/lib/reglages";
import { formaterDate, formaterNombre } from "@/lib/format";

export default function PageMatchsAdmin({ searchParams }: PageProps<"/admin/matchs">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Matchs searchParams={searchParams} />
    </Suspense>
  );
}

type Match = {
  id: number;
  date_match: string;
  statut: string;
  statut_api: string | null;
  buts_dom: number | null;
  buts_ext: number | null;
  buts_dom_api: number | null;
  buts_ext_api: number | null;
  marche_id: number | null;
  ligue: { nom: string } | null;
  dom: { nom: string } | null;
  ext: { nom: string } | null;
};

const STATUTS: Record<string, { libelle: string; ton: "neutre" | "accent" | "attention" | "danger" }> = {
  a_venir: { libelle: "À venir", ton: "neutre" },
  en_cours: { libelle: "En cours", ton: "attention" },
  termine: { libelle: "Terminé", ton: "accent" },
  annule: { libelle: "Annulé", ton: "danger" },
  reporte: { libelle: "Reporté", ton: "danger" },
};

async function Matchs({ searchParams }: { searchParams: Promise<Params> }) {
  await exigerAdmin();
  const params = await searchParams;
  const { page, debut, fin } = lirePage(params);
  const { tri, croissant } = lireTri(params, ["date_match"] as const, "date_match", "asc");
  const statut = valeur(params, "statut");
  const ligue = valeur(params, "ligue");

  const supabase = await creerClientServeur();
  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kinshasa" }).format(new Date());
  let requete = supabase
    .from("matchs")
    .select(
      "id, date_match, statut, statut_api, buts_dom, buts_ext, buts_dom_api, buts_ext_api, marche_id, ligue:ligues(nom), dom:equipes!matchs_equipe_dom_id_fkey(nom), ext:equipes!matchs_equipe_ext_id_fkey(nom)",
      { count: "exact" },
    );
  if (statut) requete = requete.eq("statut", statut);
  if (/^\d+$/.test(ligue)) requete = requete.eq("ligue_id", Number(ligue));
  const [{ data, count }, { data: ligues }, { data: appels }, { data: imports }, reglages] = await Promise.all([
    requete.order(tri, { ascending: croissant }).range(debut, fin).returns<Match[]>(),
    supabase.from("ligues").select("id, nom, pays, id_externe, active").order("ordre"),
    supabase.from("appels_api").select("nombre").eq("jour", jour).eq("fournisseur", "api_football").maybeSingle(),
    supabase.from("imports_football").select("id, type, debut, statut, appels, matchs, message, declenche_par").order("debut", { ascending: false }).limit(8),
    lireReglages(),
  ]);

  const colonnes: Colonne<Match>[] = [
    { cle: "date", titre: "Coup d'envoi (Kinshasa)", tri: "date_match", rendu: (m) => <span className="whitespace-nowrap">{formaterDate(m.date_match)}</span> },
    { cle: "ligue", titre: "Ligue", rendu: (m) => m.ligue?.nom },
    {
      cle: "match",
      titre: "Match",
      rendu: (m) => (
        <span>
          {m.dom?.nom} – {m.ext?.nom}
          {m.statut === "termine" && <strong className="ml-1.5 tabular-nums">{m.buts_dom}-{m.buts_ext}</strong>}
        </span>
      ),
    },
    { cle: "statut", titre: "Statut", rendu: (m) => <Pastille ton={STATUTS[m.statut]?.ton}>{STATUTS[m.statut]?.libelle ?? m.statut}</Pastille> },
    { cle: "api", titre: "Fournisseur", rendu: (m) => <span className="text-xs text-adm-secondaire">{m.statut_api ?? "—"}{m.buts_dom_api !== null ? ` ${m.buts_dom_api}-${m.buts_ext_api}` : ""}</span> },
    {
      cle: "marche",
      titre: "Marché",
      rendu: (m) =>
        m.marche_id ? (
          <Link href={`/admin/marches/${m.marche_id}`} className="text-adm-accent hover:underline">
            n° {m.marche_id}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      cle: "corriger",
      titre: "",
      rendu: (m) =>
        m.statut === "termine" || m.statut === "annule" || m.statut === "reporte" ? null : (
          <span className="flex flex-wrap gap-1.5">
            <ActionConfirmee
              action={corrigerMatch.bind(null, m.id)}
              libelle="Saisir le score"
              variante="secondaire"
              danger={false}
              titre={`${m.dom?.nom} – ${m.ext?.nom}`}
              message="Score à la fin du temps réglementaire (90 minutes). Le marché est réglé tout de suite et les gains versés."
              confirmer="Enregistrer et régler"
              champs={[
                { nom: "buts_dom", libelle: `Buts ${m.dom?.nom}`, requis: true, type: "nombre" },
                { nom: "buts_ext", libelle: `Buts ${m.ext?.nom}`, requis: true, type: "nombre" },
              ]}
            />
            <ActionConfirmee
              action={async (d: FormData) => {
                "use server";
                d.set("statut", "annule");
                return corrigerMatch(m.id, d);
              }}
              libelle="Annuler"
              titre="Annuler ce match ?"
              message="Toutes les mises sur ce match seront remboursées."
              confirmer="Annuler et rembourser"
            />
          </span>
        ),
    },
  ];

  const utilisees = appels?.nombre ?? 0;
  const limite = Number(reglages.api_football_limite_jour);

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre="Matchs"
        description={`Import API-Football, saison ${String(reglages.football_saison)}. Matchs à venir une fois par jour, résultats seulement après la fin des matchs. Le site continue avec les données en base si l'API ne répond pas.`}
        actions={<BoutonAction action={importerMaintenant} libelle="Importer maintenant" variante="principal" />}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Chiffre valeur={`${utilisees} / ${limite}`} libelle="Requêtes API aujourd'hui" alerte={utilisees >= limite} />
        <Chiffre valeur={formaterNombre(count ?? 0)} libelle="Matchs (filtre actuel)" />
        <Chiffre valeur={String(reglages.football_saison)} libelle="Saison importée" />
        <Chiffre valeur={`${String(reglages.football_decalage_jours)} j`} libelle="Décalage de test" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section titre="Ligues" className="[&>div:last-child]:p-0">
          <table className="w-full text-sm">
            <tbody>
              {(ligues ?? []).map((l) => (
                <tr key={l.id} className="border-b border-adm-bordure last:border-b-0">
                  <td className="px-4 py-2 font-medium">{l.nom}</td>
                  <td className="px-2 py-2 text-[13px] text-adm-secondaire">
                    {l.pays} · n° {l.id_externe}
                  </td>
                  <td className="px-2 py-2">{l.active ? <Pastille ton="accent">Active</Pastille> : <Pastille>Inactive</Pastille>}</td>
                  <td className="px-4 py-2 text-right">
                    <BoutonAction action={activerLigue.bind(null, l.id, !l.active)} libelle={l.active ? "Désactiver" : "Activer"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section titre="Derniers imports" className="[&>div:last-child]:p-0">
          <table className="w-full text-[13px]">
            <tbody>
              {(imports ?? []).map((i) => (
                <tr key={i.id} className="border-b border-adm-bordure align-top last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-2">{formaterDate(i.debut)}</td>
                  <td className="px-2 py-2">{i.type === "a_venir" ? "À venir" : "Résultats"}</td>
                  <td className="px-2 py-2">
                    <Pastille ton={i.statut === "ok" ? "accent" : i.statut ? "danger" : "attention"}>{i.statut ?? "en cours"}</Pastille>
                  </td>
                  <td className="px-2 py-2 tabular-nums">{i.appels} req.</td>
                  <td className="px-4 py-2 text-adm-secondaire">
                    {i.declenche_par} · {i.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(imports ?? []).length === 0 && <p className="p-4 text-sm text-adm-secondaire">Aucun import pour l&apos;instant.</p>}
        </Section>
      </div>

      <Filtres chemin="/admin/matchs">
        <ChampFiltre libelle="Statut">
          <select name="statut" defaultValue={statut} className={cls.champ}>
            <option value="">Tous</option>
            {Object.entries(STATUTS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.libelle}
              </option>
            ))}
          </select>
        </ChampFiltre>
        <ChampFiltre libelle="Ligue">
          <select name="ligue" defaultValue={ligue} className={cls.champ}>
            <option value="">Toutes</option>
            {(ligues ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
        </ChampFiltre>
      </Filtres>
      <Tableau
        chemin="/admin/matchs"
        params={params}
        colonnes={colonnes}
        lignes={data ?? []}
        cle={(m) => m.id}
        total={count ?? 0}
        page={page}
        tri={tri}
        croissant={croissant}
        vide="Aucun match. Clique sur « Importer maintenant »."
      />
    </div>
  );
}
