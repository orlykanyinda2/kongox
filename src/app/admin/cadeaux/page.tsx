import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FormulaireCadeau } from "@/components/admin/Formulaires";
import { BoutonAction } from "@/components/admin/BoutonAction";
import { annulerCadeau, marquerCadeauEnvoye } from "@/app/actions/admin";
import { exigerAdmin } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate } from "@/lib/format";

export default function PageCadeaux() {
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-carte bg-doux" />}>
      <Cadeaux />
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
  gagnant: { nom_utilisateur: string } | null;
};

// Cadeaux manuels : l'admin marque un gagnant, l'équipe envoie le crédit à la main puis clique « Envoyé ».
async function Cadeaux() {
  await exigerAdmin();
  const t = await getTranslations("admin");
  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("cadeaux")
    .select("id, type, description, statut, telephone, cree_le, envoye_le, utilisateur_id, gagnant:utilisateurs!cadeaux_utilisateur_id_fkey(nom_utilisateur)")
    .order("cree_le", { ascending: false })
    .limit(60)
    .returns<Cadeau[]>();
  const aEnvoyer = (data ?? []).filter((c) => c.statut === "a_envoyer");
  const historique = (data ?? []).filter((c) => c.statut !== "a_envoyer");
  const ids = aEnvoyer.map((c) => c.utilisateur_id);
  const { data: coords } = ids.length
    ? await supabase.from("coordonnees_utilisateurs").select("utilisateur_id, telephone").in("utilisateur_id", ids)
    : { data: [] as { utilisateur_id: string; telephone: string | null }[] };

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <main className="flex min-w-0 flex-1 flex-col gap-5">
        <div>
          <h1 className="text-[32px] tracking-[-1px] md:text-4xl">{t("menu.cadeaux")}</h1>
          <p className="mt-1.5 text-[15px] text-texte-secondaire">{t("cadeauxTexte")}</p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">{t("cadeauxAEnvoyer")}</h2>
          {aEnvoyer.length === 0 && <p className="rounded-carte border-2 border-dashed border-sauge p-6 text-center font-bold">{t("aucunCadeau")}</p>}
          {aEnvoyer.map((c) => {
            const tel = coords?.find((x) => x.utilisateur_id === c.utilisateur_id)?.telephone ?? null;
            return (
              <article key={c.id} className="flex flex-wrap items-center gap-3 rounded-carte border-2 border-contour bg-surface p-4 shadow-decale">
                <div className="min-w-0 flex-[1_1_240px]">
                  <Link href={`/admin/utilisateurs/${c.utilisateur_id}`} className="font-bold hover:underline">
                    @{c.gagnant?.nom_utilisateur}
                  </Link>
                  <p className="text-sm">
                    {t(`cadeauType.${c.type}`)}
                    {c.description && <> · {c.description}</>}
                  </p>
                  <p className="text-sm font-bold">{tel ?? <span className="text-brique">{t("numeroManquant")}</span>}</p>
                </div>
                <BoutonAction action={marquerCadeauEnvoye.bind(null, c.id)} libelle={t("envoye")} variante="oui" petit />
                <BoutonAction action={annulerCadeau.bind(null, c.id)} libelle={t("annulerCadeau")} petit confirmation={t("confirmerAnnulerCadeau")} />
              </article>
            );
          })}
        </section>

        <section className="rounded-carte border-2 border-contour bg-surface p-5">
          <h2 className="text-xl">{t("historiqueCadeaux")}</h2>
          <ul className="mt-2 text-sm">
            {historique.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 border-b border-separateur py-2 last:border-b-0">
                <span>
                  <strong>@{c.gagnant?.nom_utilisateur}</strong> · {t(`cadeauType.${c.type}`)}
                  {c.telephone && <> · {c.telephone}</>}
                </span>
                <span className="text-texte-secondaire">
                  {c.statut === "envoye" ? t("envoyeLe", { date: formaterDate(c.envoye_le!) }) : t("annuleStatut")}
                </span>
              </li>
            ))}
            {historique.length === 0 && <li className="py-2 text-texte-secondaire">—</li>}
          </ul>
        </section>
      </main>
      <aside className="xl:w-[340px] xl:flex-none">
        <FormulaireCadeau />
      </aside>
    </div>
  );
}
