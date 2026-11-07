import { Suspense } from "react";
import Link from "next/link";
import { EnTetePage, Section, StatutMarche, Vide } from "@/components/admin/ui";
import { exigerAdmin } from "@/lib/admin/acces";
import { motifRecherche, valeur, type Params } from "@/lib/admin/tableau";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterNombre } from "@/lib/format";

export default function PageRecherche({ searchParams }: PageProps<"/admin/recherche">) {
  return (
    <Suspense fallback={<div className="h-64 rounded-lg bg-adm-zone" />}>
      <Recherche searchParams={searchParams} />
    </Suspense>
  );
}

// Recherche globale (barre du haut) : comptes et marchés
async function Recherche({ searchParams }: { searchParams: Promise<Params> }) {
  await exigerAdmin();
  const q = valeur(await searchParams, "q").replace(/^@/, "");
  const supabase = await creerClientServeur();
  const [{ data: comptes }, { data: marches }] = q
    ? await Promise.all([
        supabase.from("utilisateurs").select("id, nom_utilisateur, role, solde_pieces").ilike("nom_utilisateur", motifRecherche(q)).order("nom_utilisateur").limit(20),
        /^\d+$/.test(q)
          ? supabase.from("marches").select("id, question, statut").eq("id", Number(q)).limit(1)
          : supabase.from("marches").select("id, question, statut").ilike("question", motifRecherche(q)).order("id", { ascending: false }).limit(20),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre={q ? `Recherche : « ${q} »` : "Recherche"} description="Comptes (nom d'utilisateur) et marchés (texte de la question ou numéro)." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Section titre={`Comptes (${comptes?.length ?? 0})`} className="[&>div:last-child]:p-0">
          <ul>
            {(comptes ?? []).map((u) => (
              <li key={u.id} className="flex justify-between border-b border-adm-bordure px-4 py-2 last:border-b-0">
                <Link href={`/admin/utilisateurs/${u.id}`} className="text-adm-accent hover:underline">
                  @{u.nom_utilisateur}
                </Link>
                <span className="text-[13px] text-adm-secondaire tabular-nums">
                  {u.role !== "utilisateur" && `${u.role} · `}
                  {formaterNombre(u.solde_pieces)} pièces
                </span>
              </li>
            ))}
          </ul>
          {(comptes ?? []).length === 0 && <Vide>Aucun compte.</Vide>}
        </Section>
        <Section titre={`Marchés (${marches?.length ?? 0})`} className="[&>div:last-child]:p-0">
          <ul>
            {(marches ?? []).map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 border-b border-adm-bordure px-4 py-2 last:border-b-0">
                <Link href={`/admin/marches/${m.id}`} className="text-adm-accent hover:underline">
                  n° {m.id} · {m.question}
                </Link>
                <StatutMarche statut={m.statut} />
              </li>
            ))}
          </ul>
          {(marches ?? []).length === 0 && <Vide>Aucun marché.</Vide>}
        </Section>
      </div>
    </div>
  );
}
