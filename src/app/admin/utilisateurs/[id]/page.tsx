import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnTetePage, Pastille, Section } from "@/components/admin/ui";
import { ActionConfirmee } from "@/components/admin/Actions";
import { FormulaireAjustement, FormulaireMotDePasse, FormulaireRole } from "@/components/admin/FormulairesUtilisateur";
import { suspendre } from "@/app/actions/admin";
import { exigerAdmin } from "@/lib/admin/acces";
import { libelleAction } from "@/lib/admin/libelles";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { lireReglages } from "@/lib/reglages";
import { estFutur, formaterDate, formaterNombre } from "@/lib/format";

export default function PageUtilisateur({ params }: PageProps<"/admin/utilisateurs/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Fiche params={params} />
    </Suspense>
  );
}

type Prediction = { id: number; montant: number; statut: string; gain: number; cree_le: string; marche: { id: number; question: string } | null; option: { libelle: string } | null };

const STATUTS_PREDICTION: Record<string, string> = { en_cours: "En cours", gagnee: "Gagnée", perdue: "Perdue", remboursee: "Remboursée" };

async function Fiche({ params }: { params: Promise<{ id: string }> }) {
  const acces = await exigerAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await creerClientServeur();

  const [{ data: u }, { data: coord }, { data: transactions }, { data: predictions }, { data: stats }, { data: auth }, { data: journal }, reglages] = await Promise.all([
    supabase.from("utilisateurs").select("id, nom_utilisateur, role, solde_pieces, serie_jours, badges, cree_le, dernier_bonus_le").eq("id", id).maybeSingle(),
    supabase.from("coordonnees_utilisateurs").select("email_contact, telephone").eq("utilisateur_id", id).maybeSingle(),
    supabase.from("transactions_pieces").select("id, montant, type, description, solde_apres, cree_le").eq("utilisateur_id", id).order("cree_le", { ascending: false }).limit(30),
    supabase
      .from("predictions")
      .select("id, montant, statut, gain, cree_le, marche:marches(id, question), option:options_marche(libelle)")
      .eq("utilisateur_id", id)
      .order("cree_le", { ascending: false })
      .limit(20)
      .returns<Prediction[]>(),
    supabase.from("predictions").select("statut").eq("utilisateur_id", id),
    creerClientAdmin().auth.admin.getUserById(id),
    supabase
      .from("journal_admin")
      .select("id, action, cree_le, auteur:utilisateurs!journal_admin_auteur_id_fkey(nom_utilisateur)")
      .eq("cible_utilisateur", id)
      .order("cree_le", { ascending: false })
      .limit(10)
      .returns<{ id: number; action: string; cree_le: string; auteur: { nom_utilisateur: string } | null }[]>(),
    lireReglages(),
  ]);
  if (!u) notFound();

  const suspendu = estFutur((auth?.user as { banned_until?: string } | null)?.banned_until);
  const gagnees = (stats ?? []).filter((p) => p.statut === "gagnee").length;
  const reglees = (stats ?? []).filter((p) => p.statut === "gagnee" || p.statut === "perdue").length;
  const soiMeme = u.id === acces.utilisateur.id;

  const infos: [string, string][] = [
    ["Solde", `${formaterNombre(u.solde_pieces)} pièces`],
    ["Taux de réussite", reglees ? `${Math.round((gagnees * 100) / reglees)} % (${gagnees}/${reglees})` : "—"],
    ["Prédictions", formaterNombre((stats ?? []).length)],
    ["Série", `${u.serie_jours} jour(s)`],
    ["Téléphone", coord?.telephone ?? "non renseigné"],
    ["E-mail de contact", coord?.email_contact ?? "non renseigné"],
    ["Inscrit le", formaterDate(u.cree_le)],
    ["Dernier bonus", u.dernier_bonus_le ?? "—"],
  ];

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre={`@${u.nom_utilisateur}`}
        actions={
          <Link href="/admin/utilisateurs" className="text-[13px] text-adm-secondaire underline">
            ← Tous les utilisateurs
          </Link>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Pastille ton={u.role === "utilisateur" ? "neutre" : "accent"}>{u.role === "admin" ? "Admin" : u.role === "curateur" ? "Curateur" : "Utilisateur"}</Pastille>
        {suspendu && <Pastille ton="danger">Suspendu</Pastille>}
        {u.badges.map((b: string) => (
          <Pastille key={b}>{b}</Pastille>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-adm-bordure bg-adm-bordure md:grid-cols-4">
        {infos.map(([cle, v]) => (
          <div key={cle} className="bg-white px-3 py-2.5">
            <div className="text-xs text-adm-secondaire">{cle}</div>
            <div className="mt-0.5 font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section titre="Rôle et compte">
          <div className="flex flex-col gap-4">
            <FormulaireRole utilisateur={u.id} role={u.role} />
            {!soiMeme && (
              <ActionConfirmee
                action={suspendre.bind(null, u.id, !suspendu)}
                libelle={suspendu ? "Réactiver le compte" : "Suspendre le compte"}
                variante={suspendu ? "secondaire" : "danger"}
                danger={!suspendu}
                titre={suspendu ? `Réactiver @${u.nom_utilisateur} ?` : `Suspendre @${u.nom_utilisateur} ?`}
                message={
                  suspendu
                    ? "La personne pourra de nouveau se connecter."
                    : "La personne ne pourra plus se connecter. Une session déjà ouverte expire en moins d'une heure. Ses pièces restent intactes."
                }
                confirmer={suspendu ? "Réactiver" : "Suspendre"}
              />
            )}
            <div>
              <div className="mb-1 text-[13px] font-semibold">Mot de passe</div>
              <FormulaireMotDePasse nom={u.nom_utilisateur} />
            </div>
          </div>
        </Section>
        <Section titre="Ajuster les pièces">
          {soiMeme ? (
            <p className="text-sm text-adm-secondaire">Pas d&apos;ajustement sur ton propre compte.</p>
          ) : (
            <FormulaireAjustement nom={u.nom_utilisateur} max={Number(reglages.ajustement_max)} />
          )}
        </Section>
      </div>

      <Section titre="Prédictions récentes" className="[&>div:last-child]:p-0">
        <table className="w-full text-sm">
          <thead className="bg-adm-zone text-left text-[13px]">
            <tr>
              {["Date", "Marché", "Choix", "Mise", "Statut", "Gain"].map((t, i) => (
                <th key={t} scope="col" className={`border-b border-adm-bordure px-3 py-2 font-semibold ${i >= 3 && i !== 4 ? "text-right" : ""}`}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(predictions ?? []).map((p) => (
              <tr key={p.id} className="border-b border-adm-bordure last:border-b-0">
                <td className="whitespace-nowrap px-3 py-1.5">{formaterDate(p.cree_le)}</td>
                <td className="px-3 py-1.5">
                  {p.marche && (
                    <Link href={`/admin/marches/${p.marche.id}`} className="hover:underline">
                      {p.marche.question}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-1.5">{p.option?.libelle}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formaterNombre(p.montant)}</td>
                <td className="px-3 py-1.5">{STATUTS_PREDICTION[p.statut] ?? p.statut}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{p.gain ? formaterNombre(p.gain) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(predictions ?? []).length === 0 && <p className="py-5 text-center text-sm text-adm-secondaire">Aucune prédiction.</p>}
      </Section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Section titre="Transactions de pièces (30 dernières)" className="[&>div:last-child]:p-0">
          <table className="w-full text-sm">
            <thead className="bg-adm-zone text-left text-[13px]">
              <tr>
                {["Date", "Description", "Montant", "Solde après"].map((t, i) => (
                  <th key={t} scope="col" className={`border-b border-adm-bordure px-3 py-2 font-semibold ${i >= 2 ? "text-right" : ""}`}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(transactions ?? []).map((tr) => (
                <tr key={tr.id} className="border-b border-adm-bordure last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-1.5">{formaterDate(tr.cree_le)}</td>
                  <td className="px-3 py-1.5">{tr.description ?? tr.type}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${tr.montant < 0 ? "text-adm-danger" : ""}`}>
                    {tr.montant > 0 ? "+" : "−"}
                    {formaterNombre(Math.abs(tr.montant))}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formaterNombre(tr.solde_apres)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section titre="Journal (ce compte)">
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {(journal ?? []).map((j) => (
              <li key={j.id}>
                <span className="text-adm-secondaire">{formaterDate(j.cree_le)}</span> · {libelleAction(j.action)}
                {j.auteur && <> · par @{j.auteur.nom_utilisateur}</>}
              </li>
            ))}
            {(journal ?? []).length === 0 && <li className="text-adm-secondaire">Aucune action.</li>}
          </ul>
          <Link href={`/admin/journal?utilisateur=${u.nom_utilisateur}`} className="mt-2 inline-block text-[13px] text-adm-accent underline">
            Tout le journal de ce compte
          </Link>
        </Section>
      </div>
    </div>
  );
}
