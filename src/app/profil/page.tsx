import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";
import { IconePiece } from "@/components/IconePiece";
import { BonusQuotidien } from "@/components/compte/BonusQuotidien";
import { FormulaireCoordonnee } from "@/components/compte/FormulaireCoordonnee";
import { FormulaireNouveauMotDePasse } from "@/components/compte/FormulaireNouveauMotDePasse";
import { deconnecter } from "@/app/actions/compte";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate, formaterNombre, formaterPieces } from "@/lib/format";

export const metadata = { title: "Mon profil — KongoX" };

type Utilisateur = {
  id: string;
  nom_utilisateur: string;
  role: string;
  solde_pieces: number;
  serie_jours: number;
  badges: string[];
  cree_le: string;
};

type Transaction = {
  id: number;
  montant: number;
  type: string;
  description: string | null;
  cree_le: string;
};

type Question = { id: number; question: string; categorie: Categorie; statut: string; motif: string | null };

const carte = "rounded-carte border-2 border-contour bg-surface p-[22px] shadow-decale-md";

// Page « Mon profil » de l'étape 1 : solde, série, coordonnées facultatives, historique des pièces.
// Le profil public complet (score Mayele, abonnés, prédictions) arrive à l'étape 4.
export default function PageProfil() {
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />

      <Suspense fallback={<ChargementProfil />}>
        <ContenuProfil />
      </Suspense>

      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}

function ChargementProfil() {
  return (
    <main className="mx-auto w-full max-w-contenu flex-1 px-[18px] py-8 md:px-6" aria-busy="true">
      <div className="h-48 animate-pulse rounded-carte bg-doux" />
    </main>
  );
}

async function ContenuProfil() {
  const t = await getTranslations("profil");
  const supabase = await creerClientServeur();

  const { data: session } = await supabase.auth.getClaims();
  const id = session?.claims?.sub;
  if (!id) redirect("/connexion");

  const [{ data: utilisateur }, { data: coordonnees }, { data: transactions }, { data: questions }] = await Promise.all([
    supabase.from("utilisateurs").select("id, nom_utilisateur, role, solde_pieces, serie_jours, badges, cree_le").eq("id", id).single<Utilisateur>(),
    supabase.from("coordonnees_utilisateurs").select("email_contact, telephone").eq("utilisateur_id", id).maybeSingle<{ email_contact: string | null; telephone: string | null }>(),
    supabase.from("transactions_pieces").select("id, montant, type, description, cree_le").order("cree_le", { ascending: false }).limit(10).returns<Transaction[]>(),
    supabase.from("marches").select("id, question, categorie, statut, motif").eq("auteur_id", id).order("cree_le", { ascending: false }).limit(10).returns<Question[]>(),
  ]);

  if (!utilisateur) {
    return (
      <main className="mx-auto w-full max-w-contenu flex-1 px-[18px] py-8 md:px-6">
        <p role="alert" className={carte}>
          {t("introuvable")}
        </p>
      </main>
    );
  }

  const initiales = utilisateur.nom_utilisateur
    .split("_")
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join("");
  const membreDepuis = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Africa/Kinshasa" }).format(new Date(utilisateur.cree_le));

  return (
    <main className="mx-auto flex w-full max-w-contenu flex-1 flex-col gap-5 px-[18px] py-6 md:px-6 md:py-8">
      <BonusQuotidien utilisateurId={utilisateur.id} />

      <div className="flex flex-wrap gap-5">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-5">
          {/* Identité, badges et chiffres */}
          <section className={`${carte} flex flex-col gap-[18px]`}>
            <div className="flex items-center gap-4">
              <span className="flex size-[72px] flex-none items-center justify-center rounded-full border-2 border-foret bg-vert-jaune font-titre text-2xl font-bold text-foret shadow-foret">
                {initiales}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[26px] tracking-[-0.5px] md:text-[32px]">@{utilisateur.nom_utilisateur}</h1>
                <p className="text-sm text-texte-secondaire">{t("membreDepuis", { date: membreDepuis })}</p>
              </div>
            </div>

            {(utilisateur.serie_jours > 0 || utilisateur.badges.length > 0 || utilisateur.role !== "utilisateur") && (
              <ul className="flex flex-wrap gap-2" aria-label={t("badges")}>
                {utilisateur.role !== "utilisateur" && (
                  <li className="rounded-full border-2 border-foret bg-foret px-3 py-1.5 text-[13px] font-bold text-white">{t(`role.${utilisateur.role}`)}</li>
                )}
                {utilisateur.badges.map((b) => (
                  <li key={b} className="rounded-full border-2 border-foret bg-vert-jaune px-3 py-1.5 text-[13px] font-bold text-foret">
                    {b}
                  </li>
                ))}
                {utilisateur.serie_jours > 0 && (
                  <li className="rounded-full border-2 border-foret bg-brique px-3 py-1.5 text-[13px] font-bold text-white">
                    {t("serieBadge", { jours: utilisateur.serie_jours })}
                  </li>
                )}
              </ul>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border-2 border-contour bg-doux p-4">
                <div className="flex items-center gap-2 font-titre text-[30px] font-bold">
                  <IconePiece taille={24} />
                  {formaterNombre(utilisateur.solde_pieces)}
                </div>
                <div className="mt-0.5 text-[13px] text-texte-secondaire">{t("pieces")}</div>
              </div>
              <div className="rounded-2xl border-2 border-contour bg-doux p-4">
                <div className="font-titre text-[30px] font-bold">{formaterNombre(utilisateur.serie_jours)}</div>
                <div className="mt-0.5 text-[13px] text-texte-secondaire">{t("joursDeSuite")}</div>
              </div>
            </div>
            <p className="text-[13px] text-texte-secondaire">{t("regleSerie")}</p>
          </section>

          {/* Historique des pièces */}
          <section className={carte}>
            <h2 className="text-[21px]">{t("historique")}</h2>
            {transactions && transactions.length > 0 ? (
              <ul className="mt-3.5 flex flex-col">
                {transactions.map((tr) => (
                  <li key={tr.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-separateur py-3 last:border-b-0">
                    <span className="min-w-0 flex-[1_1_220px] text-[15px] font-semibold">{tr.description ?? t(`type.${tr.type}`)}</span>
                    <span className="text-xs text-texte-secondaire">{formaterDate(tr.cree_le)}</span>
                    <span className={`min-w-20 text-right text-[15px] font-bold ${tr.montant > 0 ? "text-hunter dark:text-vert-jaune" : ""}`}>
                      {tr.montant > 0 ? "+" : "−"}
                      {formaterPieces(Math.abs(tr.montant))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-texte-secondaire">{t("aucuneTransaction")}</p>
            )}
          </section>

          {/* Questions proposées et leur statut */}
          <section className={carte}>
            <h2 className="text-[21px]">{t("mesQuestions")}</h2>
            {questions && questions.length > 0 ? (
              <ul className="mt-3.5 flex flex-col">
                {questions.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-separateur py-3 last:border-b-0">
                    <span className="text-xs font-bold text-texte-secondaire">{LIBELLES_CATEGORIES[q.categorie]}</span>
                    <span className="min-w-0 flex-[1_1_240px] text-[15px] font-semibold">
                      {q.statut === "en_attente" || q.statut === "refuse" ? (
                        q.question
                      ) : (
                        <Link href={`/marches/${q.id}`} className="underline">
                          {q.question}
                        </Link>
                      )}
                    </span>
                    <span className="rounded-full border-2 border-contour px-2.5 py-1 text-xs font-bold">{t(`statutQuestion.${q.statut}`)}</span>
                    {q.statut === "refuse" && q.motif && <span className="w-full text-xs text-texte-secondaire">{t("motif", { motif: q.motif })}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-texte-secondaire">
                {t("aucuneQuestion")}{" "}
                <Link href="/proposer" className="font-bold underline">
                  {t("proposerQuestion")}
                </Link>
              </p>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          {/* Téléphone pour les cadeaux */}
          <section className="rounded-carte border-2 border-foret bg-hunter p-[22px] text-white shadow-brique-md">
            <h2 className="text-[21px]">{t("cadeauxTitre")}</h2>
            <p className="mt-2 text-sm leading-normal text-[#E4EAD3]">{t("cadeauxTexte")}</p>
            <FormulaireCoordonnee champ="telephone" valeur={coordonnees?.telephone ?? null} libelle={t("telephone")} placeholder="+243 8…" sombre />
          </section>

          {/* E-mail de contact */}
          <section className={carte}>
            <h2 className="text-[21px]">{t("mesInfos")}</h2>
            <p className="mt-2 text-sm leading-normal text-texte-secondaire">
              {t("resume", {
                email: coordonnees?.email_contact ?? t("nonRenseigne"),
                telephone: coordonnees?.telephone ?? t("nonRenseigne"),
              })}
            </p>
            <FormulaireCoordonnee champ="email_contact" valeur={coordonnees?.email_contact ?? null} libelle={t("emailContact")} placeholder="nom@exemple.com" />
            <p className="text-xs text-texte-secondaire">{t("emailFacultatif")}</p>
          </section>

          {/* Mot de passe */}
          <section className={carte}>
            <h2 className="text-[21px]">{t("motDePasse")}</h2>
            <FormulaireNouveauMotDePasse />
          </section>

          {/* Panneau admin, ou candidature curateur */}
          <section className={`${carte} flex flex-col gap-2`}>
            {utilisateur.role === "admin" || utilisateur.role === "curateur" ? (
              <Link href="/admin" className="flex h-12 items-center justify-center rounded-bouton border-2 border-foret bg-vert-jaune font-bold text-foret">
                {t("ouvrirAdmin")}
              </Link>
            ) : null}
            <Link href="/curateur" className="text-center text-sm font-bold underline">
              {t("devenirCurateur")}
            </Link>
          </section>

          <form action={deconnecter}>
            <button type="submit" className="h-12 w-full rounded-champ border-2 border-contour bg-surface text-[15px] font-bold text-texte">
              {t("deconnexion")}
            </button>
          </form>

          <p className="text-center text-xs text-texte-secondaire">{t("jamaisArgentReel")}</p>
        </aside>
      </div>
    </main>
  );
}
