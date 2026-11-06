import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { exigerAdmin } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterNombre } from "@/lib/format";

export default function PageUtilisateurs({ searchParams }: PageProps<"/admin/utilisateurs">) {
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-carte bg-doux" />}>
      <Utilisateurs searchParams={searchParams} />
    </Suspense>
  );
}

const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Kinshasa" });

async function Utilisateurs({ searchParams }: { searchParams: PageProps<"/admin/utilisateurs">["searchParams"] }) {
  await exigerAdmin();
  const t = await getTranslations("admin");
  const q = String((await searchParams).q ?? "").trim().replace(/^@/, "");
  const supabase = await creerClientServeur();

  let requete = supabase.from("utilisateurs").select("id, nom_utilisateur, role, solde_pieces, serie_jours, cree_le");
  if (q) requete = requete.ilike("nom_utilisateur", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data } = await requete.order("cree_le", { ascending: false }).limit(30);

  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-[32px] tracking-[-1px] md:text-4xl">{t("utilisateursTitre")}</h1>
      <form method="get" className="flex flex-wrap gap-2.5" role="search">
        <label htmlFor="q" className="sr-only">
          {t("rechercherUtilisateur")}
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder={t("rechercherUtilisateur")}
          autoCapitalize="none"
          className="h-[46px] min-w-0 flex-1 rounded-bouton border-2 border-contour bg-surface px-3.5 text-[15px] text-texte"
        />
        <button type="submit" className="h-[46px] rounded-bouton border-2 border-foret bg-foret px-5 font-bold text-white dark:border-vert-jaune">
          {t("chercher")}
        </button>
      </form>
      <p className="text-sm text-texte-secondaire">{q ? t("resultatsPour", { n: data?.length ?? 0, q }) : t("derniersInscrits")}</p>
      <ul className="flex flex-col rounded-carte border-2 border-contour bg-surface p-2">
        {(data ?? []).map((u) => (
          <li key={u.id} className="border-b border-separateur last:border-b-0">
            <Link href={`/admin/utilisateurs/${u.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-bouton px-3 py-3 hover:bg-doux">
              <strong className="min-w-0 flex-[1_1_200px]">@{u.nom_utilisateur}</strong>
              {u.role !== "utilisateur" && <span className="rounded-full bg-foret px-2.5 py-0.5 text-xs font-bold text-white">{t(`roles.${u.role}`)}</span>}
              <span className="text-sm">{formaterNombre(u.solde_pieces)} {t("pieces")}</span>
              <span className="text-xs text-texte-secondaire">{t("inscritLe", { date: date.format(new Date(u.cree_le)) })}</span>
            </Link>
          </li>
        ))}
        {(data ?? []).length === 0 && <li className="p-4 text-sm">{t("aucunUtilisateur")}</li>}
      </ul>
    </main>
  );
}
