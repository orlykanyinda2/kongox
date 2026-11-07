import { Suspense } from "react";
import { EnTetePage, Pastille, Section } from "@/components/admin/ui";
import { BoutonAction } from "@/components/admin/Actions";
import { FormulaireCommunaute, FormulaireDuel } from "@/components/admin/FormulairesCommunaute";
import { activerDuel } from "@/app/actions/backoffice";
import { exigerAdmin } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterNombre } from "@/lib/format";

export default function PageCommunautes() {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Communautes />
    </Suspense>
  );
}

const TYPES: Record<string, string> = { ville: "Ville", universite: "Université", fan_club: "Fan-club", autre: "Autre" };

// Communautés (villes, universités, fan-clubs) et duels « communauté contre communauté » de la page Classement
async function Communautes() {
  await exigerAdmin();
  const supabase = await creerClientServeur();
  const [{ data: communautes }, { data: membres }, { data: duels }] = await Promise.all([
    supabase.from("communautes").select("id, nom, type, description, active").order("nom"),
    supabase.from("membres_communaute").select("communaute_id"),
    supabase
      .from("duels_communautes")
      .select("id, titre, actif, a:communautes!duels_communautes_communaute_a_fkey(nom), b:communautes!duels_communautes_communaute_b_fkey(nom)")
      .order("ordre")
      .returns<{ id: number; titre: string; actif: boolean; a: { nom: string } | null; b: { nom: string } | null }[]>(),
  ]);
  const nombre = (id: number) => (membres ?? []).filter((m) => m.communaute_id === id).length;

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre="Communautés" description="Chaque membre rejoint jusqu'à 3 communautés depuis son profil. Le score Mayele d'une communauté = prédictions justes de ses membres ÷ prédictions réglées." />
      <Section titre="Nouvelle communauté">
        <FormulaireCommunaute />
      </Section>
      <Section titre={`Communautés (${(communautes ?? []).length})`} className="[&>div:last-child]:p-0">
        <table className="w-full text-sm">
          <thead className="bg-adm-zone text-left text-[13px]">
            <tr>
              {["Nom", "Type", "Membres", "Description"].map((t, i) => (
                <th key={t} scope="col" className={`border-b border-adm-bordure px-3 py-2 font-semibold ${i === 2 ? "text-right" : ""}`}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(communautes ?? []).map((c) => (
              <tr key={c.id} className="border-b border-adm-bordure last:border-b-0">
                <td className="px-3 py-2 font-medium">{c.nom}</td>
                <td className="px-3 py-2">{TYPES[c.type] ?? c.type}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formaterNombre(nombre(c.id))}</td>
                <td className="px-3 py-2 text-adm-secondaire">{c.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(communautes ?? []).length === 0 && <p className="p-4 text-sm text-adm-secondaire">Aucune communauté pour l&apos;instant.</p>}
      </Section>
      <Section titre="Duels affichés sur la page Classement">
        <FormulaireDuel communautes={(communautes ?? []).filter((c) => c.active)} />
        <ul className="mt-4 flex flex-col gap-2">
          {(duels ?? []).map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-md border border-adm-bordure px-3 py-2 text-sm">
              <strong>{d.titre}</strong> · {d.a?.nom} contre {d.b?.nom}
              {d.actif ? <Pastille ton="accent">Affiché</Pastille> : <Pastille>Masqué</Pastille>}
              <span className="flex-1" />
              <BoutonAction action={activerDuel.bind(null, d.id, !d.actif)} libelle={d.actif ? "Masquer" : "Afficher"} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
