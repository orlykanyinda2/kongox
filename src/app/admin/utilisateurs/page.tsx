import { Suspense } from "react";
import Link from "next/link";
import { EnTetePage, Pastille, Section, cls } from "@/components/admin/ui";
import { ChampFiltre, Filtres, Tableau, type Colonne } from "@/components/admin/Tableau";
import { FormulaireMotDePasse } from "@/components/admin/FormulairesUtilisateur";
import { exigerAdmin } from "@/lib/admin/acces";
import { lienAvec, lirePage, lireTri, motifRecherche, valeur, type Params } from "@/lib/admin/tableau";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate, formaterNombre } from "@/lib/format";

export default function PageUtilisateurs({ searchParams }: PageProps<"/admin/utilisateurs">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Utilisateurs searchParams={searchParams} />
    </Suspense>
  );
}

type Ligne = { id: string; nom_utilisateur: string; role: string; solde_pieces: number; serie_jours: number; cree_le: string; dernier_bonus_le: string | null };

const TRIS = ["cree_le", "nom_utilisateur", "solde_pieces", "serie_jours", "dernier_bonus_le"] as const;

async function Utilisateurs({ searchParams }: { searchParams: Promise<Params> }) {
  await exigerAdmin();
  const params = await searchParams;
  const { page, debut, fin } = lirePage(params);
  const { tri, croissant } = lireTri(params, TRIS, "cree_le");
  const q = valeur(params, "q").replace(/^@/, "");
  const role = valeur(params, "role");

  const supabase = await creerClientServeur();
  let requete = supabase.from("utilisateurs").select("id, nom_utilisateur, role, solde_pieces, serie_jours, cree_le, dernier_bonus_le", { count: "exact" });
  if (q) requete = requete.ilike("nom_utilisateur", motifRecherche(q));
  if (role) requete = requete.eq("role", role);
  const { data, count } = await requete.order(tri, { ascending: croissant, nullsFirst: false }).range(debut, fin).returns<Ligne[]>();

  const colonnes: Colonne<Ligne>[] = [
    {
      cle: "nom",
      titre: "Nom d'utilisateur",
      tri: "nom_utilisateur",
      rendu: (u) => (
        <Link href={`/admin/utilisateurs/${u.id}`} className="font-medium text-adm-accent hover:underline">
          @{u.nom_utilisateur}
        </Link>
      ),
    },
    { cle: "role", titre: "Rôle", rendu: (u) => (u.role === "utilisateur" ? "Utilisateur" : <Pastille ton="accent">{u.role === "admin" ? "Admin" : "Curateur"}</Pastille>) },
    { cle: "solde", titre: "Solde", tri: "solde_pieces", droite: true, rendu: (u) => formaterNombre(u.solde_pieces) },
    { cle: "serie", titre: "Série", tri: "serie_jours", droite: true, rendu: (u) => `${u.serie_jours} j` },
    { cle: "visite", titre: "Dernier bonus", tri: "dernier_bonus_le", rendu: (u) => (u.dernier_bonus_le ? new Date(`${u.dernier_bonus_le}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "—") },
    { cle: "inscrit", titre: "Inscrit le", tri: "cree_le", rendu: (u) => formaterDate(u.cree_le) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <EnTetePage titre="Utilisateurs" description="Recherche, fiche complète, rôle, suspension et mots de passe." />
      <Section titre="Mot de passe oublié">
        <FormulaireMotDePasse />
        <p className="mt-2 text-xs text-adm-secondaire">Vérifie d&apos;abord que la demande vient bien du numéro WhatsApp habituel de la personne.</p>
      </Section>
      <Filtres chemin="/admin/utilisateurs" exportCsv={lienAvec("/admin/export/utilisateurs", params, { page: null })}>
        <ChampFiltre libelle="Nom d'utilisateur">
          <input name="q" defaultValue={q} autoCapitalize="none" className={cls.champ} />
        </ChampFiltre>
        <ChampFiltre libelle="Rôle">
          <select name="role" defaultValue={role} className={cls.champ}>
            <option value="">Tous</option>
            <option value="utilisateur">Utilisateur</option>
            <option value="curateur">Curateur</option>
            <option value="admin">Admin</option>
          </select>
        </ChampFiltre>
      </Filtres>
      <Tableau
        chemin="/admin/utilisateurs"
        params={params}
        colonnes={colonnes}
        lignes={data ?? []}
        cle={(u) => u.id}
        total={count ?? 0}
        page={page}
        tri={tri}
        croissant={croissant}
        vide="Aucun utilisateur ne correspond."
      />
    </div>
  );
}
