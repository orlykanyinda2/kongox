import { Suspense } from "react";
import Link from "next/link";
import { EnTetePage, Section, cls } from "@/components/admin/ui";
import { ChampFiltre, Filtres, Tableau, type Colonne } from "@/components/admin/Tableau";
import { FormulaireAjustement, FormulaireBonusMasse } from "@/components/admin/FormulairesUtilisateur";
import { exigerAdmin } from "@/lib/admin/acces";
import { lienAvec, lirePage, lireTri, valeur, type Params } from "@/lib/admin/tableau";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { lireReglages } from "@/lib/reglages";
import { formaterDate, formaterNombre } from "@/lib/format";

export default function PagePieces({ searchParams }: PageProps<"/admin/pieces">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Pieces searchParams={searchParams} />
    </Suspense>
  );
}

type Ligne = {
  id: number;
  montant: number;
  raison: string;
  lot: string | null;
  solde_avant: number;
  solde_apres: number;
  cree_le: string;
  compte: { id: string; nom_utilisateur: string } | null;
  auteur: { nom_utilisateur: string } | null;
};

const TRIS = ["cree_le", "montant"] as const;

// Ajustements de pièces (type « ajustement_admin », toujours par mouvement_pieces()) et bonus en masse
async function Pieces({ searchParams }: { searchParams: Promise<Params> }) {
  await exigerAdmin();
  const params = await searchParams;
  const { page, debut, fin } = lirePage(params);
  const { tri, croissant } = lireTri(params, TRIS, "cree_le");
  const sens = valeur(params, "sens");
  const lot = valeur(params, "lot");

  const supabase = await creerClientServeur();
  let requete = supabase
    .from("ajustements_pieces")
    .select(
      "id, montant, raison, lot, solde_avant, solde_apres, cree_le, compte:utilisateurs!ajustements_pieces_utilisateur_id_fkey(id, nom_utilisateur), auteur:utilisateurs!ajustements_pieces_auteur_id_fkey(nom_utilisateur)",
      { count: "exact" },
    );
  if (sens === "ajout") requete = requete.gt("montant", 0);
  if (sens === "retrait") requete = requete.lt("montant", 0);
  if (/^[0-9a-f-]{36}$/.test(lot)) requete = requete.eq("lot", lot);
  const [{ data, count }, reglages] = await Promise.all([
    requete.order(tri, { ascending: croissant }).range(debut, fin).returns<Ligne[]>(),
    lireReglages(),
  ]);

  const colonnes: Colonne<Ligne>[] = [
    { cle: "date", titre: "Date", tri: "cree_le", rendu: (a) => formaterDate(a.cree_le) },
    {
      cle: "compte",
      titre: "Compte",
      rendu: (a) =>
        a.compte ? (
          <Link href={`/admin/utilisateurs/${a.compte.id}`} className="text-adm-accent hover:underline">
            @{a.compte.nom_utilisateur}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      cle: "montant",
      titre: "Montant",
      tri: "montant",
      droite: true,
      rendu: (a) => <span className={a.montant < 0 ? "text-adm-danger" : ""}>{(a.montant > 0 ? "+" : "−") + formaterNombre(Math.abs(a.montant))}</span>,
    },
    { cle: "solde", titre: "Solde avant → après", droite: true, rendu: (a) => `${formaterNombre(a.solde_avant)} → ${formaterNombre(a.solde_apres)}` },
    { cle: "raison", titre: "Raison", rendu: (a) => a.raison },
    {
      cle: "lot",
      titre: "Bonus en masse",
      rendu: (a) =>
        a.lot ? (
          <Link href={`/admin/pieces?lot=${a.lot}`} className="text-[13px] text-adm-accent underline">
            voir le lot
          </Link>
        ) : (
          "—"
        ),
    },
    { cle: "auteur", titre: "Par", rendu: (a) => (a.auteur ? `@${a.auteur.nom_utilisateur}` : "—") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre="Pièces"
        description="Ajouter ou retirer des pièces avec une raison obligatoire. Le solde ne devient jamais négatif, et personne ne s'ajoute des pièces à soi-même."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Section titre="Ajuster un compte">
          <FormulaireAjustement max={Number(reglages.ajustement_max)} />
        </Section>
        <Section titre="Bonus en masse">
          <FormulaireBonusMasse />
        </Section>
      </div>
      <h2 className="mt-2 text-[15px] font-semibold">Historique des ajustements</h2>
      <Filtres chemin="/admin/pieces" exportCsv={lienAvec("/admin/export/ajustements", params, { page: null })}>
        <ChampFiltre libelle="Opération">
          <select name="sens" defaultValue={sens} className={cls.champ}>
            <option value="">Toutes</option>
            <option value="ajout">Ajouts</option>
            <option value="retrait">Retraits</option>
          </select>
        </ChampFiltre>
        {lot && <input type="hidden" name="lot" value={lot} />}
      </Filtres>
      <Tableau
        chemin="/admin/pieces"
        params={params}
        colonnes={colonnes}
        lignes={data ?? []}
        cle={(a) => a.id}
        total={count ?? 0}
        page={page}
        tri={tri}
        croissant={croissant}
        vide="Aucun ajustement pour l'instant."
      />
    </div>
  );
}
