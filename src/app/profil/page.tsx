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
import { BoutonSocial } from "@/components/social/BoutonSocial";
import { rejoindreCommunaute } from "@/app/actions/social";
import { deconnecter } from "@/app/actions/compte";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate, formaterNombre, formaterPieces } from "@/lib/format";
import { lireReglages } from "@/lib/reglages";
import { ReserveAuxComptes } from "@/components/compte/ReserveAuxComptes";
import { CreerCompteInvite } from "@/components/compte/CreerCompteInvite";
import { BadgeIcone, type Niveau } from "@/components/badges/BadgeIcone";
import { Avatar } from "@/components/profil/Avatar";

export const metadata = { title: "Mon profil — KongoX" };

type Utilisateur = {
  id: string;
  nom_utilisateur: string;
  role: string;
  solde_pieces: number;
  serie_jours: number;
  badges: string[];
  cree_le: string;
  invite: boolean;
  icone: string | null;
  photo: string | null;
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

  const [{ data: utilisateur }, { data: coordonnees }, { data: transactions }, { data: questions }, { data: communautes }, { data: membre }, { data: cadeaux }] = await Promise.all([
    supabase.from("utilisateurs").select("id, nom_utilisateur, role, solde_pieces, serie_jours, badges, cree_le, invite, icone, photo").eq("id", id).single<Utilisateur>(),
    supabase.from("coordonnees_utilisateurs").select("email_contact, telephone").eq("utilisateur_id", id).maybeSingle<{ email_contact: string | null; telephone: string | null }>(),
    supabase.from("transactions_pieces").select("id, montant, type, description, cree_le").order("cree_le", { ascending: false }).limit(10).returns<Transaction[]>(),
    supabase.from("marches").select("id, question, categorie, statut, motif").eq("auteur_id", id).order("cree_le", { ascending: false }).limit(10).returns<Question[]>(),
    supabase.from("communautes").select("id, nom, type").eq("active", true).order("nom").returns<{ id: number; nom: string; type: string }[]>(),
    supabase.from("membres_communaute").select("communaute_id").eq("utilisateur_id", id),
    supabase
      .from("cadeaux")
      .select("id, type, description, sponsor, statut, cree_le")
      .eq("utilisateur_id", id)
      .neq("statut", "annule")
      .order("cree_le", { ascending: false })
      .limit(5)
      .returns<{ id: number; type: string; description: string | null; sponsor: string | null; statut: string; cree_le: string }[]>(),
  ]);
  const aEnvoyer = (cadeaux ?? []).some((c) => c.statut === "a_envoyer");
  const mesCommunautes = new Set((membre ?? []).map((m) => m.communaute_id));
  const [{ data: mesBadges }, { data: iconeInfo }] = await Promise.all([
    supabase
      .from("badges_gagnes")
      .select("gagne_le, badge:badges!badges_gagnes_badge_code_fkey(code, nom, glyphe, niveau)")
      .eq("utilisateur_id", id)
      .order("gagne_le", { ascending: false })
      .returns<{ gagne_le: string; badge: { code: string; nom: string; glyphe: string; niveau: string } }[]>(),
    supabase.from("icones").select("niveau").eq("code", utilisateur?.icone ?? "").maybeSingle<{ niveau: string }>(),
  ]);
  const elite = iconeInfo?.niveau === "elite" && !utilisateur?.photo;

  if (!utilisateur) {
    return (
      <main className="mx-auto w-full max-w-contenu flex-1 px-[18px] py-8 md:px-6">
        <p role="alert" className={carte}>
          {t("introuvable")}
        </p>
      </main>
    );
  }

  const membreDepuis = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Africa/Kinshasa" }).format(new Date(utilisateur.cree_le));

  return (
    <main className="mx-auto flex w-full max-w-contenu flex-1 flex-col gap-5 px-[18px] py-6 md:px-6 md:py-8">
      {utilisateur.invite ? (
        <CreerCompteInvite nom={utilisateur.nom_utilisateur} pieces={Number((await lireReglages()).bonus_inscription ?? 1000)} />
      ) : (
        <BonusQuotidien utilisateurId={utilisateur.id} />
      )}

      <div className="flex flex-wrap gap-5">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-5">
          {/* Identité, badges et chiffres */}
          <section className={`${carte} flex flex-col gap-[18px]`}>
            <div className="flex items-center gap-4">
              <Link href="/profil/icone" aria-label="Changer mon icône" className="relative flex-none">
                <Avatar nom={utilisateur.nom_utilisateur} icone={utilisateur.icone} photo={utilisateur.photo} elite={elite} taille={72} />
                <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-foret bg-vert-jaune px-1.5 text-[11px] font-bold text-foret">Modifier</span>
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-[26px] tracking-[-0.5px] md:text-[32px]">
                  @{utilisateur.nom_utilisateur}
                  {utilisateur.invite && <span className="ml-2 align-middle text-sm font-semibold text-texte-secondaire">(invité)</span>}
                </h1>
                <p className="text-sm text-texte-secondaire">{t("membreDepuis", { date: membreDepuis })}</p>
                <Link href={`/u/${utilisateur.nom_utilisateur}`} className="text-sm font-bold text-hunter underline dark:text-vert-jaune">
                  Voir mon profil public
                </Link>
              </div>
            </div>

            {(

              <ul className="flex flex-wrap gap-2" aria-label={t("badges")}>
                {utilisateur.role !== "utilisateur" && (
                  <li className="rounded-full border-2 border-foret bg-foret px-3 py-1.5 text-[13px] font-bold text-white">{t(`role.${utilisateur.role}`)}</li>
                )}
                {(mesBadges ?? []).slice(0, 6).map((b) => (
                  <li key={b.badge.code} className="flex items-center gap-1.5 rounded-full border-2 border-foret bg-vert-jaune py-1 pl-1 pr-3 text-[13px] font-bold text-foret">
                    <BadgeIcone glyphe={b.badge.glyphe} niveau={b.badge.niveau as Niveau} taille={22} />
                    {b.badge.nom}
                  </li>
                ))}
                <li>
                  <Link href="/badges" className="flex h-full items-center rounded-full border-2 border-contour px-3 py-1.5 text-[13px] font-bold">
                    Tous mes badges
                  </Link>
                </li>
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
          {/* Téléphone pour les cadeaux (pas pour les invités) */}
          {utilisateur.invite ? (
            <ReserveAuxComptes fonction="cadeaux" />
          ) : (
          <section className="rounded-carte border-2 border-foret bg-hunter p-[22px] text-white shadow-brique-md">
            <h2 className="text-[21px]">{t("cadeauxTitre")}</h2>
            {aEnvoyer && !coordonnees?.telephone && (
              <p role="alert" className="mt-3 rounded-champ bg-vert-jaune px-3 py-2.5 text-sm font-bold text-foret">
                {t("cadeauAttendNumero")}
              </p>
            )}
            {(cadeaux ?? []).length > 0 && (
              <ul className="mt-3 flex flex-col gap-2" aria-label={t("mesCadeaux")}>
                {cadeaux!.map((c) => (
                  <li key={c.id} className="rounded-champ bg-white/10 px-3 py-2.5 text-sm">
                    <span className="font-bold">{t(`cadeau_${c.type}`)}</span>
                    {c.description && <> · {c.description}</>}
                    {c.sponsor && <> · {t("offertPar", { sponsor: c.sponsor })}</>}
                    <span className="mt-0.5 block text-xs text-[#E4EAD3]">{c.statut === "envoye" ? t("cadeauEnvoye") : t("cadeauAEnvoyer")}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-sm leading-normal text-[#E4EAD3]">{t("cadeauxTexte")}</p>
            <FormulaireCoordonnee champ="telephone" valeur={coordonnees?.telephone ?? null} libelle={t("telephone")} placeholder="+243 8…" sombre />
          </section>
          )}

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

          {/* Communautés (3 au maximum) : comptent pour « communauté contre communauté » */}
          {utilisateur.invite ? (
            <ReserveAuxComptes fonction="communautes" />
          ) : (
          <section id="communautes" className={`${carte} scroll-mt-24`}>
            <h2 className="text-[21px]">Mes communautés</h2>
            <p className="mt-2 text-sm text-texte-secondaire">Ta ville, ton université, ton fan-club : 3 au maximum.</p>
            {(communautes ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-texte-secondaire">Les communautés arrivent bientôt.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {communautes!.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-bouton bg-doux px-3 py-2">
                    <Link href={`/communautes/${c.id}`} className="text-[15px] font-semibold underline-offset-2 hover:underline">
                      {c.nom}
                    </Link>
                    <BoutonSocial action={rejoindreCommunaute.bind(null, c.id)} actif={mesCommunautes.has(c.id)} libelleActif="Quitter" libelleInactif="Rejoindre" petit />
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}

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
