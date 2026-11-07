import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { EtiquetteCategorie } from "@/components/marches/EtiquetteCategorie";
import { BoutonSocial } from "@/components/social/BoutonSocial";
import { BoutonsPartage } from "@/components/social/BoutonsPartage";
import { suivre } from "@/app/actions/social";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { estCategorie, LIBELLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";
import { formaterNombre } from "@/lib/format";
import { OPEN_GRAPH, urlSite } from "@/lib/partage";
import { resumeProfil } from "@/lib/og/profil";
import type { Metadata } from "next";

export async function generateMetadata({ params }: PageProps<"/u/[nom]">): Promise<Metadata> {
  const nom = decodeURIComponent((await params).nom).replace(/^@/, "");
  const p = await resumeProfil(nom);
  if (!p) return { robots: { index: false } };
  const description = `${p.score === null ? "Pronostiqueur" : `Score Mayele ${p.score} %`} · ${p.predictions} prédictions sur KongoX. Tu fais mieux ?`;
  return {
    title: `@${p.nom} — KongoX`,
    description,
    openGraph: { ...OPEN_GRAPH, title: `@${p.nom} sur KongoX`, description, url: `/u/${encodeURIComponent(p.nom)}` },
  };
}

// Profil public d'un pronostiqueur (maquettes/Profil.dc.html) : badges, score Mayele, abonnés, prédictions récentes.
export default function PageProfilPublic({ params, searchParams }: PageProps<"/u/[nom]">) {
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <Suspense fallback={<main className="mx-auto w-full max-w-contenu flex-1 px-[18px] py-8"><div className="h-80 animate-pulse rounded-carte bg-doux" /></main>}>
        <Profil params={params} searchParams={searchParams} />
      </Suspense>
      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}

type ProfilPublic = {
  id: string;
  nom: string;
  role: string;
  badges: string[];
  cree_le: string;
  solde: number;
  serie: number;
  predictions: number;
  reglees: number;
  gagnees: number;
  abonnes: number;
  abonnements: number;
  je_suis: boolean;
  soi_meme: boolean;
  communautes: { id: number; nom: string; type: string }[];
  themes: { categorie: Categorie; statut: string }[];
};

type Prediction = { cree_le: string; marche_id: number; question: string; categorie: string; type_reponse: string; choix: string; montant: number; statut: string; gain: number };

const FILTRES = [
  { cle: "toutes", libelle: "Toutes" },
  { cle: "en_cours", libelle: "En cours" },
  { cle: "terminees", libelle: "Terminées" },
];
const STATUTS: Record<string, { libelle: string; style: string }> = {
  en_cours: { libelle: "En cours", style: "bg-champagne text-foret" },
  gagnee: { libelle: "Gagné", style: "bg-vert-jaune text-foret" },
  perdue: { libelle: "Perdu", style: "bg-brique text-white" },
  remboursee: { libelle: "Remboursé", style: "bg-doux text-texte" },
};
const TYPES_COMMUNAUTE: Record<string, string> = { ville: "Ville", universite: "Université", fan_club: "Fan-club", autre: "Communauté" };
const moisAnnee = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Africa/Kinshasa" });

async function Profil({ params, searchParams }: { params: Promise<{ nom: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { nom: brut } = await params;
  const nom = decodeURIComponent(brut).replace(/^@/, "");
  const demande = (await searchParams).filtre;
  const filtre = FILTRES.some((f) => f.cle === demande) ? String(demande) : "toutes";
  const supabase = await creerClientServeur();
  const [{ data }, { data: preds }] = await Promise.all([
    supabase.rpc("profil_public", { p_nom: nom }),
    supabase.rpc("predictions_publiques", { p_nom: nom, p_filtre: filtre, p_limite: 20 }),
  ]);
  const p = data as ProfilPublic | null;
  if (!p) notFound();
  const predictions = (preds ?? []) as Prediction[];

  const initiales = p.nom.split("_").filter(Boolean).slice(0, 2).map((m) => m[0]?.toUpperCase()).join("");
  const score = p.reglees ? Math.round((p.gagnees * 100) / p.reglees) : null;
  const specialite = p.themes.length ? `Curateur ${p.themes.map((t) => LIBELLES_CATEGORIES[t.categorie]).join(", ")}` : null;
  const lienProfil = `${urlSite()}/u/${p.nom}`;
  const tuiles = [
    { valeur: score === null ? "—" : `${score} %`, libelle: "Score Mayele" },
    { valeur: formaterNombre(p.solde), libelle: "pièces" },
    { valeur: formaterNombre(p.predictions), libelle: "prédictions" },
    { valeur: formaterNombre(p.abonnes), libelle: p.abonnes > 1 ? "abonnés" : "abonné" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-contenu flex-1 flex-wrap items-start gap-6 px-[18px] py-6 md:px-6 md:py-10">
      <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-6">
        <section className="flex animate-monte flex-col gap-5 rounded-carte border-2 border-contour bg-surface p-5 shadow-[8px_8px_0_var(--ombre)] md:p-7">
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex size-24 flex-none items-center justify-center rounded-[28px] border-[3px] border-foret bg-vert-jaune font-titre text-4xl font-bold text-foret shadow-[5px_5px_0_#1F3A26]">
              {initiales}
            </span>
            <div className="min-w-0 flex-[1_1_240px]">
              <h1 className="truncate text-[28px] tracking-[-1px] md:text-4xl">@{p.nom}</h1>
              <p className="mt-1 text-[15px] text-texte-secondaire">
                {[p.communautes.find((c) => c.type === "ville")?.nom, `Membre depuis ${moisAnnee.format(new Date(p.cree_le))}`, specialite].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {p.soi_meme ? (
                <Link href="/profil" className="flex h-12 items-center rounded-champ border-2 border-foret bg-foret px-5 text-[15px] font-bold text-white dark:border-vert-jaune">
                  Modifier mon profil
                </Link>
              ) : (
                <SuivreOuConnexion nom={p.nom} actif={p.je_suis} />
              )}
            </div>
          </div>

          {(p.badges.length > 0 || p.serie > 1) && (
            <ul className="flex flex-wrap gap-2" aria-label="Badges">
              {p.badges.map((b, i) => (
                <li key={b} className={`rounded-full border-2 border-foret px-3 py-1.5 text-[13px] font-bold ${i % 2 ? "bg-vert-jaune text-foret" : "bg-foret text-white"}`}>
                  {b}
                </li>
              ))}
              {p.serie > 1 && <li className="rounded-full border-2 border-foret bg-brique px-3 py-1.5 text-[13px] font-bold text-white">Série de {p.serie} jours</li>}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tuiles.map((t) => (
              <div key={t.libelle} className="rounded-2xl border-2 border-contour bg-doux p-4">
                <div className="font-titre text-[26px] font-bold tabular-nums md:text-[30px]">{t.valeur}</div>
                <div className="mt-0.5 text-[13px] text-texte-secondaire">{t.libelle}</div>
              </div>
            ))}
          </div>
          {p.reglees < 5 && <p className="text-[13px] text-texte-secondaire">Score Mayele calculé sur {p.reglees} prédiction(s) réglée(s).</p>}
        </section>

        <section aria-label="Prédictions récentes" className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl md:text-[28px]">Prédictions récentes</h2>
            <div role="group" aria-label="Filtrer" className="flex gap-1.5">
              {FILTRES.map((f) => (
                <Link
                  key={f.cle}
                  href={`/u/${p.nom}${f.cle === "toutes" ? "" : `?filtre=${f.cle}`}`}
                  aria-current={f.cle === filtre ? "true" : undefined}
                  className={`flex h-10 items-center rounded-full border-2 border-contour px-3.5 text-[13px] font-bold ${
                    f.cle === filtre ? "bg-foret text-white dark:bg-vert-jaune dark:text-foret" : "bg-surface text-texte"
                  }`}
                >
                  {f.libelle}
                </Link>
              ))}
            </div>
          </div>
          {predictions.length === 0 ? (
            <p className="rounded-champ border-2 border-dashed border-sauge bg-doux p-5 text-center text-[15px]">Aucune prédiction ici pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {predictions.map((x) => {
                const s = STATUTS[x.statut] ?? STATUTS.en_cours;
                const solde = x.statut === "gagnee" ? x.gain - x.montant : x.statut === "perdue" ? -x.montant : null;
                return (
                  <li key={`${x.marche_id}-${x.cree_le}`} className="flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-champ border-2 border-contour bg-surface px-4 py-3.5">
                    {estCategorie(x.categorie) && <EtiquetteCategorie categorie={x.categorie} petite />}
                    <Link href={`/marches/${x.marche_id}`} className="min-w-0 flex-[1_1_300px] text-[15px] font-semibold hover:underline">
                      {x.question}
                    </Link>
                    <span className="text-sm text-texte-secondaire">
                      {x.choix} · {formaterNombre(x.montant)} pièces
                    </span>
                    <span className={`rounded-full border-2 border-foret px-2.5 py-1 text-xs font-bold ${s.style}`}>{s.libelle}</span>
                    <span className="min-w-16 text-right text-[15px] font-bold tabular-nums">{solde === null ? "" : `${solde > 0 ? "+" : "−"}${formaterNombre(Math.abs(solde))}`}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
        <div className="rounded-carte border-2 border-contour bg-surface p-[22px] shadow-decale-md">
          <h2 className="mb-3 text-xl">{p.soi_meme ? "Partage ton profil" : "Partager ce profil"}</h2>
          <BoutonsPartage
            url={lienProfil}
            texte={
              score !== null
                ? `@${p.nom} a un score Mayele de ${score} % sur KongoX. Tu fais mieux ?`
                : `Regarde les pronostics de @${p.nom} sur KongoX.`
            }
            carte={`/u/${encodeURIComponent(p.nom)}/opengraph-image`}
          />
        </div>
        <section className="rounded-carte border-2 border-contour bg-surface p-[22px] shadow-decale-md">
          <h2 className="text-xl">{p.soi_meme ? "Mes communautés" : "Ses communautés"}</h2>
          {p.communautes.length === 0 ? (
            <p className="mt-2 text-sm text-texte-secondaire">
              {p.soi_meme ? (
                <>
                  Aucune pour l&apos;instant.{" "}
                  <Link href="/profil#communautes" className="font-bold underline">
                    Rejoindre une communauté
                  </Link>
                </>
              ) : (
                "Aucune communauté."
              )}
            </p>
          ) : (
            <ul className="mt-3.5 flex flex-col gap-2.5">
              {p.communautes.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-bouton bg-doux px-3.5 py-3">
                  <Link href={`/communautes/${c.id}`} className="font-bold underline-offset-2 hover:underline">
                    {c.nom}
                  </Link>
                  <span className="text-[13px] text-texte-secondaire">{TYPES_COMMUNAUTE[c.type] ?? "Communauté"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-carte border-2 border-contour bg-surface p-[22px] shadow-decale-md">
          <h2 className="text-xl">Abonnements</h2>
          <p className="mt-2 text-sm text-texte-secondaire">
            {formaterNombre(p.abonnes)} abonné(s) · suit {formaterNombre(p.abonnements)} pronostiqueur(s)
          </p>
          <Link href="/classement?vue=amis" className="mt-2 inline-block text-sm font-bold underline">
            Classement entre amis
          </Link>
        </section>
      </aside>
    </main>
  );
}

// Bouton « Suivre » (les visiteurs sont renvoyés vers la connexion)
async function SuivreOuConnexion({ nom, actif }: { nom: string; actif: boolean }) {
  const supabase = await creerClientServeur();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return (
      <Link href="/connexion" className="flex h-12 items-center rounded-champ border-2 border-foret bg-foret px-[22px] text-[15px] font-bold text-white shadow-[4px_4px_0_#A7C957]">
        Suivre
      </Link>
    );
  }
  return <BoutonSocial action={suivre.bind(null, nom)} actif={actif} libelleActif="Abonné" libelleInactif="Suivre" />;
}
