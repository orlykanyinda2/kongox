import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FormulaireRole } from "@/components/admin/Formulaires";
import { BoutonAction } from "@/components/admin/BoutonAction";
import { suspendre } from "@/app/actions/admin";
import { exigerAdmin } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { estFutur, formaterDate, formaterNombre, formaterPieces } from "@/lib/format";

export default function PageUtilisateur({ params }: PageProps<"/admin/utilisateurs/[id]">) {
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-carte bg-doux" />}>
      <FicheUtilisateur params={params} />
    </Suspense>
  );
}

const carte = "rounded-carte border-2 border-contour bg-surface p-5 shadow-decale-md";

async function FicheUtilisateur({ params }: { params: PageProps<"/admin/utilisateurs/[id]">["params"] }) {
  const acces = await exigerAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = await getTranslations("admin");
  const supabase = await creerClientServeur();

  const [{ data: u }, { data: coord }, { data: transactions }, { data: stats }, { data: auth }] = await Promise.all([
    supabase.from("utilisateurs").select("id, nom_utilisateur, role, solde_pieces, serie_jours, badges, cree_le").eq("id", id).maybeSingle(),
    supabase.from("coordonnees_utilisateurs").select("email_contact, telephone").eq("utilisateur_id", id).maybeSingle(),
    supabase.from("transactions_pieces").select("id, montant, type, description, cree_le").eq("utilisateur_id", id).order("cree_le", { ascending: false }).limit(20),
    supabase.from("predictions").select("statut").eq("utilisateur_id", id),
    creerClientAdmin().auth.admin.getUserById(id),
  ]);
  if (!u) notFound();

  // Suspension : vraie si la date de fin de suspension est dans le futur
  const banniJusquA = (auth?.user as { banned_until?: string } | null)?.banned_until;
  const suspendu = estFutur(banniJusquA);
  const gagnees = (stats ?? []).filter((p) => p.statut === "gagnee").length;
  const reglees = (stats ?? []).filter((p) => p.statut === "gagnee" || p.statut === "perdue").length;
  const soiMeme = u.id === acces.utilisateur.id;

  return (
    <main className="flex flex-col gap-5">
      <Link href="/admin/utilisateurs" className="text-sm font-semibold text-texte-secondaire underline">
        {t("retourUtilisateurs")}
      </Link>
      <section className={carte}>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] tracking-[-0.5px]">@{u.nom_utilisateur}</h1>
          <span className="rounded-full bg-foret px-2.5 py-1 text-xs font-bold text-white">{t(`roles.${u.role}`)}</span>
          {suspendu && <span className="rounded-full bg-brique px-2.5 py-1 text-xs font-bold text-white">{t("estSuspendu")}</span>}
        </div>
        <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 text-sm">
          {[
            [t("solde"), formaterPieces(u.solde_pieces)],
            [t("serie"), `${u.serie_jours} j`],
            [t("predictionsReglees"), reglees ? `${gagnees}/${reglees} (${Math.round((gagnees * 100) / reglees)} %)` : "—"],
            [t("telephone"), coord?.telephone ?? t("nonRenseigne")],
            [t("emailContact"), coord?.email_contact ?? t("nonRenseigne")],
            [t("inscrit"), formaterDate(u.cree_le)],
          ].map(([cle, valeur]) => (
            <div key={cle} className="rounded-bouton bg-doux p-3">
              <dt className="text-xs text-texte-secondaire">{cle}</dt>
              <dd className="mt-0.5 font-bold">{valeur}</dd>
            </div>
          ))}
        </dl>
        {u.badges.length > 0 && <p className="mt-3 text-sm">{t("badges")} : {u.badges.join(" · ")}</p>}
      </section>

      <section className={`${carte} flex flex-col gap-4`}>
        <h2 className="text-xl">{t("actions")}</h2>
        <FormulaireRole utilisateur={u.id} role={u.role} />
        {!soiMeme && (
          <div>
            <BoutonAction
              action={suspendre.bind(null, u.id, !suspendu)}
              libelle={suspendu ? t("reactiver") : t("suspendre")}
              variante={suspendu ? "oui" : "non"}
              confirmation={suspendu ? undefined : t("confirmerSuspension", { nom: u.nom_utilisateur })}
            />
            <p className="mt-1.5 text-xs text-texte-secondaire">{t("suspensionAide")}</p>
          </div>
        )}
        <p className="text-xs text-texte-secondaire">{t("mdpAide")}</p>
      </section>

      <section className={carte}>
        <h2 className="text-xl">{t("dernieresTransactions")}</h2>
        <ul className="mt-3">
          {(transactions ?? []).map((tr) => (
            <li key={tr.id} className="flex flex-wrap justify-between gap-x-3 border-b border-separateur py-2 text-sm last:border-b-0">
              <span className="min-w-0 flex-[1_1_240px]">{tr.description ?? tr.type}</span>
              <span className="text-xs text-texte-secondaire">{formaterDate(tr.cree_le)}</span>
              <strong className={tr.montant > 0 ? "text-hunter dark:text-vert-jaune" : ""}>
                {tr.montant > 0 ? "+" : "−"}
                {formaterNombre(Math.abs(tr.montant))}
              </strong>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
