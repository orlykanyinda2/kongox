import { Suspense } from "react";
import Link from "next/link";
import { EnTetePage, Pastille, Section, cls } from "@/components/admin/ui";
import { ChampFiltre, Filtres, Tableau, type Colonne } from "@/components/admin/Tableau";
import { ActionConfirmee, BoutonAction } from "@/components/admin/Actions";
import { FormulaireCadeau } from "@/components/admin/FormulaireCadeau";
import { annulerCadeau, marquerCadeauEnvoye, marquerGagnant } from "@/app/actions/admin";
import { exigerAdmin } from "@/lib/admin/acces";
import { lirePage, lireTri, valeur, type Params } from "@/lib/admin/tableau";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate } from "@/lib/format";

export default function PageCadeaux({ searchParams }: PageProps<"/admin/cadeaux">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Cadeaux searchParams={searchParams} />
    </Suspense>
  );
}

type Cadeau = {
  id: number;
  type: string;
  description: string | null;
  statut: string;
  telephone: string | null;
  cree_le: string;
  envoye_le: string | null;
  utilisateur_id: string;
  sponsor: string | null;
  gagnant: { nom_utilisateur: string } | null;
};

const TYPES: Record<string, string> = { credit: "Crédit", forfait_internet: "Forfait internet", produit: "Produit" };
const STATUTS: Record<string, { libelle: string; ton: "attention" | "accent" | "neutre" }> = {
  a_envoyer: { libelle: "À envoyer", ton: "attention" },
  envoye: { libelle: "Envoyé", ton: "accent" },
  annule: { libelle: "Annulé", ton: "neutre" },
};

// Cadeaux manuels : l'admin marque un gagnant, l'équipe envoie le crédit à la main puis clique « Envoyé ».
async function Cadeaux({ searchParams }: { searchParams: Promise<Params> }) {
  await exigerAdmin();
  const params = await searchParams;
  const { page, debut, fin } = lirePage(params);
  const { tri, croissant } = lireTri(params, ["cree_le", "envoye_le"] as const, "cree_le");
  const statut = valeur(params, "statut") || "a_envoyer";

  const supabase = await creerClientServeur();
  let requete = supabase
    .from("cadeaux")
    .select("id, type, description, sponsor, statut, telephone, cree_le, envoye_le, utilisateur_id, gagnant:utilisateurs!cadeaux_utilisateur_id_fkey(nom_utilisateur)", { count: "exact" });
  if (statut !== "tous") requete = requete.eq("statut", statut);
  const { data, count } = await requete.order(tri, { ascending: croissant, nullsFirst: false }).range(debut, fin).returns<Cadeau[]>();

  // Numéro actuel des gagnants (pour les cadeaux à envoyer)
  const ids = (data ?? []).filter((c) => c.statut === "a_envoyer").map((c) => c.utilisateur_id);
  const { data: coords } = ids.length
    ? await supabase.from("coordonnees_utilisateurs").select("utilisateur_id, telephone").in("utilisateur_id", ids)
    : { data: [] as { utilisateur_id: string; telephone: string | null }[] };
  const numero = (c: Cadeau) => c.telephone ?? coords?.find((x) => x.utilisateur_id === c.utilisateur_id)?.telephone ?? null;

  const colonnes: Colonne<Cadeau>[] = [
    { cle: "date", titre: "Marqué le", tri: "cree_le", rendu: (c) => formaterDate(c.cree_le) },
    {
      cle: "gagnant",
      titre: "Gagnant",
      rendu: (c) => (
        <Link href={`/admin/utilisateurs/${c.utilisateur_id}`} className="text-adm-accent hover:underline">
          @{c.gagnant?.nom_utilisateur}
        </Link>
      ),
    },
    { cle: "cadeau", titre: "Cadeau", rendu: (c) => `${TYPES[c.type] ?? c.type}${c.description ? ` · ${c.description}` : ""}${c.sponsor ? ` · offert par ${c.sponsor}` : ""}` },
    { cle: "numero", titre: "Numéro", rendu: (c) => numero(c) ?? <Pastille ton="danger">Numéro manquant</Pastille> },
    { cle: "statut", titre: "Statut", rendu: (c) => <Pastille ton={STATUTS[c.statut]?.ton}>{STATUTS[c.statut]?.libelle}</Pastille> },
    { cle: "envoye", titre: "Envoyé le", tri: "envoye_le", rendu: (c) => (c.envoye_le ? formaterDate(c.envoye_le) : "—") },
    {
      cle: "actions",
      titre: "",
      rendu: (c) =>
        c.statut === "a_envoyer" ? (
          <span className="flex flex-wrap gap-1.5">
            <BoutonAction action={marquerCadeauEnvoye.bind(null, c.id)} libelle="Marquer envoyé" variante="principal" />
            <ActionConfirmee
              action={annulerCadeau.bind(null, c.id)}
              libelle="Annuler"
              titre="Annuler ce cadeau ?"
              message={`Le cadeau de @${c.gagnant?.nom_utilisateur} sera retiré de la liste.`}
              confirmer="Annuler le cadeau"
            />
          </span>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre="Cadeaux" description="Rien n'est envoyé automatiquement. « Marquer envoyé » exige un numéro dans le profil du gagnant (un cadeau par numéro)." />
      <Section titre="Marquer un gagnant">
        <FormulaireCadeau />
      </Section>
      <Suspense fallback={null}>
        <GagnantsProposes />
      </Suspense>
      <Filtres chemin="/admin/cadeaux">
        <ChampFiltre libelle="Statut">
          <select name="statut" defaultValue={statut} className={cls.champ}>
            <option value="a_envoyer">À envoyer</option>
            <option value="envoye">Envoyés</option>
            <option value="annule">Annulés</option>
            <option value="tous">Tous</option>
          </select>
        </ChampFiltre>
      </Filtres>
      <Tableau
        chemin="/admin/cadeaux"
        params={params}
        colonnes={colonnes}
        lignes={data ?? []}
        cle={(c) => c.id}
        total={count ?? 0}
        page={page}
        tri={tri}
        croissant={croissant}
        vide="Aucun cadeau."
      />
    </div>
  );
}

type LigneClassement = { rang: number; utilisateur_id: string; nom_utilisateur: string; score_mayele: number; predictions_reglees: number };

// Fonction à part : la règle « purity » interdit Date.now() directement dans un composant
function ilYaSeptJours() {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}

const jour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Kinshasa" });

// Gagnants proposés : les 5 premiers du classement de la semaine et du mois (score Mayele).
// L'admin choisit ; « Marquer gagnant » ajoute un cadeau « Crédit » à envoyer.
async function GagnantsProposes() {
  const supabase = await creerClientServeur();
  const [{ data: semaine }, { data: mois }] = await Promise.all([
    supabase.rpc("classement", { p_periode: "semaine", p_limite: 5 }),
    supabase.rpc("classement", { p_periode: "mois", p_limite: 5 }),
  ]);
  const lignes = [...((semaine ?? []) as LigneClassement[]), ...((mois ?? []) as LigneClassement[])];
  const ids = [...new Set(lignes.map((l) => l.utilisateur_id))];
  const [{ data: coords }, { data: recents }] = ids.length
    ? await Promise.all([
        supabase.from("coordonnees_utilisateurs").select("utilisateur_id, telephone").in("utilisateur_id", ids),
        supabase.from("cadeaux").select("utilisateur_id").in("utilisateur_id", ids).neq("statut", "annule").gte("cree_le", ilYaSeptJours()),
      ])
    : [{ data: [] }, { data: [] }];
  const avecNumero = new Set((coords ?? []).filter((c: { telephone: string | null }) => c.telephone).map((c: { utilisateur_id: string }) => c.utilisateur_id));
  const dejaMarque = new Set((recents ?? []).map((c: { utilisateur_id: string }) => c.utilisateur_id));
  const aujourdhui = jour.format(new Date());

  const bloc = (titre: string, liste: LigneClassement[], periode: string) => (
    <div className="min-w-0 flex-1">
      <h3 className="mb-2 text-sm font-semibold">{titre}</h3>
      {liste.length === 0 ? (
        <p className="text-sm text-adm-secondaire">Personne n&apos;a encore assez de prédictions réglées.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {liste.map((l) => (
            <li key={l.utilisateur_id} className="flex flex-wrap items-center gap-2 rounded-md border border-adm-bordure px-2.5 py-1.5 text-sm">
              <span className="w-6 font-semibold tabular-nums">{l.rang}.</span>
              <Link href={`/admin/utilisateurs/${l.utilisateur_id}`} className="font-medium text-adm-accent hover:underline">
                @{l.nom_utilisateur}
              </Link>
              <span className="text-xs text-adm-secondaire tabular-nums">
                {l.score_mayele} % · {l.predictions_reglees} prédictions
              </span>
              {!avecNumero.has(l.utilisateur_id) && <Pastille ton="attention">Sans numéro</Pastille>}
              <span className="ml-auto">
                {dejaMarque.has(l.utilisateur_id) ? (
                  <Pastille ton="neutre">Cadeau cette semaine</Pastille>
                ) : (
                  <BoutonAction action={marquerGagnant.bind(null, l.nom_utilisateur, `Top ${l.rang} ${periode} (${aujourdhui})`)} libelle="Marquer gagnant" />
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  return (
    <Section titre="Gagnants proposés (classement)">
      <div className="flex flex-col gap-5 md:flex-row">
        {bloc("Semaine en cours", (semaine ?? []) as LigneClassement[], "de la semaine")}
        {bloc("Mois en cours", (mois ?? []) as LigneClassement[], "du mois")}
      </div>
    </Section>
  );
}
