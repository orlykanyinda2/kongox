import { Suspense } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { IconePiece } from "@/components/IconePiece";
import { IconeEtincelle, IconeEtoile, IconeLecture } from "@/components/icones";
import { BarrePourcentage } from "@/components/marches/BarrePourcentage";
import { historiqueMarche, listerMarchesOuverts, type Marche } from "@/lib/marches/donnees";
import { POINTS_CATEGORIES } from "@/lib/marches/categories";
import { utilisateurConnecte } from "@/lib/compte/session";
import { formaterNombre } from "@/lib/format";

// Marché mis en avant : celui marqué « Soki du jour », sinon le plus misé
export async function marcheDuJour(): Promise<Marche | null> {
  const marches = await listerMarchesOuverts();
  return marches.find((m) => m.soki_du_jour) ?? marches[0] ?? null;
}

// Bouton principal : « Commencer » pour un visiteur, « Voir les marchés » si connecté
async function BoutonCommencer({ classe }: { classe: string }) {
  const u = await utilisateurConnecte();
  const t = await getTranslations("accueil");
  return (
    <Link href={u ? "#marches" : "/inscription"} className={classe}>
      <IconePiece taille={20} />
      {u ? t("voirMarches") : t("commencer")}
    </Link>
  );
}

// =====================================================================
// Mobile (maquettes/Mobile.dc.html)
// =====================================================================
export function HeroMobile() {
  const t = useTranslations("accueil");
  const tc = useTranslations("commun");
  const classeBouton =
    "relative mt-[18px] flex h-[52px] items-center justify-center gap-2 rounded-champ bg-foret text-base font-bold text-white shadow-[4px_4px_0_#A7C957] dark:border-2 dark:border-vert-jaune";

  return (
    <div className="flex flex-col gap-[18px] px-[18px] md:hidden">
      <section aria-labelledby="titre-mobile" className="relative -mx-[18px] overflow-hidden border-b-2 border-contour px-[18px] pb-[34px] pt-[30px] text-center">
        <div aria-hidden="true" className="absolute left-3.5 top-3.5 size-[38px] animate-flotte rounded-full border-[9px] border-vert-jaune" />
        <div aria-hidden="true" className="absolute right-[18px] top-5 size-[30px] animate-tourne rounded-[9px] border-2 border-foret bg-brique" />
        <div aria-hidden="true" className="absolute -bottom-10 -left-10 size-[110px] animate-flotte-lent rounded-full bg-sauge opacity-85" />

        <span className="relative inline-flex animate-monte items-center gap-2 rounded-full border-2 border-contour bg-surface py-1.5 pl-[9px] pr-3 text-xs font-bold">
          <span className="size-2 animate-pulse-direct rounded-full bg-brique" />
          {tc("jamaisArgentReel").replace(".", "")}
        </span>
        <h1 id="titre-mobile" className="relative mt-[22px] animate-monte text-[44px] leading-[0.98] tracking-[-1.5px] delai-200">
          {t("titre")}
          <br />
          <span className="mt-3 inline-block animate-rebond rounded-[22px] border-[3px] border-foret bg-vert-jaune px-[18px] pb-2 pt-0.5 text-foret shadow-[6px_6px_0_#1F3A26]">
            {t("pastille")}
          </span>
        </h1>
        <p className="relative mt-[26px] animate-monte text-[15px] leading-normal text-texte-secondaire delai-400">{t("accrocheMobile")}</p>
        <Suspense
          fallback={
            <Link href="/inscription" className={classeBouton}>
              {t("commencer")}
            </Link>
          }
        >
          <BoutonCommencer classe={classeBouton} />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <SerieMobile />
      </Suspense>

      <Suspense fallback={<div className="h-[260px] animate-pulse rounded-[22px] bg-doux" />}>
        <SokiMobile />
      </Suspense>
    </div>
  );
}

async function SerieMobile() {
  const u = await utilisateurConnecte();
  if (!u || u.serie_jours < 1) return null;
  const t = await getTranslations("accueil");
  return (
    <div className="flex items-center gap-2.5 rounded-champ border-2 border-foret bg-foret px-3.5 py-3 text-white">
      <IconeEtoile className="animate-pulse-direct rounded-full text-vert-jaune" />
      <span className="text-sm font-semibold">{t("serie", { jours: u.serie_jours })}</span>
    </div>
  );
}

async function SokiMobile() {
  const m = await marcheDuJour();
  if (!m) return null;
  const t = await getTranslations("accueil");
  return (
    <article className="rounded-[22px] border-2 border-foret bg-hunter p-5 text-white shadow-brique-md">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-brique px-2.5 py-[5px] text-xs font-bold">{t("sokiDuJour")}</span>
        <span className="text-xs font-semibold text-[#C9D4B8]">{m.finLibelle}</span>
      </div>
      <h2 className="mt-3.5 text-2xl leading-[1.15]">
        <Link href={`/marches/${m.id}`}>{m.question}</Link>
      </h2>
      <div className="mt-3.5 flex items-baseline gap-2">
        <span className="font-titre text-[44px] font-bold leading-none text-vert-jaune">{m.pourcentageOui} %</span>
        <span className="text-sm text-[#E4EAD3]">{t("pensentOui")}</span>
      </div>
      <div className="mt-3 flex">
        <BarrePourcentage pourcentage={m.pourcentageOui} animee couleurOui="vert-jaune" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href={`/marches/${m.id}?choix=oui`} className="flex h-[50px] items-center justify-center rounded-champ bg-vert-jaune text-base font-bold text-foret">
          OUI · {m.pourcentageOui} %
        </Link>
        <Link href={`/marches/${m.id}?choix=non`} className="flex h-[50px] items-center justify-center rounded-champ bg-brique text-base font-bold text-white">
          NON · {100 - m.pourcentageOui} %
        </Link>
      </div>
    </article>
  );
}

// =====================================================================
// Ordinateur (maquettes/Main.dc.html)
// =====================================================================
export function HeroOrdinateur() {
  const t = useTranslations("accueil");
  const classeBouton =
    "flex h-[58px] items-center gap-2.5 rounded-2xl bg-foret px-7 text-[17px] font-bold text-white shadow-[6px_6px_0_#A7C957]";

  return (
    <section aria-labelledby="hero-titre" className="relative hidden overflow-hidden border-b-2 border-foret bg-white text-foret md:block">
      <div aria-hidden="true" className="absolute left-[5%] top-14 size-[76px] animate-flotte rounded-full border-[18px] border-vert-jaune" />
      <div aria-hidden="true" className="absolute right-[7%] top-[90px] size-16 animate-tourne rounded-[18px] border-2 border-foret bg-brique" />
      <div aria-hidden="true" className="absolute -left-[60px] top-[470px] size-[220px] animate-flotte-lent rounded-full bg-sauge" />
      <div aria-hidden="true" className="absolute -right-10 top-[380px] size-40 rotate-12 animate-flotte-lent rounded-[40px] bg-vert-clair" />
      <IconeEtincelle className="absolute left-[14%] top-[300px] animate-tourne" />

      <div className="relative mx-auto flex max-w-[1180px] flex-col items-center px-6 pb-14 pt-[72px] text-center">
        <span className="inline-flex animate-monte items-center gap-2.5 rounded-full border-2 border-foret bg-white py-2 pl-3 pr-4 text-sm font-bold">
          <span className="size-2.5 animate-pulse-direct rounded-full bg-vert-jaune" />
          {t("badgeHero")}
        </span>
        <h1 id="hero-titre" className="mt-7 animate-monte text-[clamp(48px,7.4vw,112px)] leading-[0.95] tracking-[-3px] delai-200">
          {t("titre")}
          <br />
          <span className="mt-3.5 inline-block animate-rebond rounded-[36px] border-4 border-foret bg-vert-jaune px-[34px] pb-3.5 pt-1 shadow-[10px_10px_0_#1F3A26]">
            {t("pastille")}
          </span>
        </h1>
        <p className="mt-10 max-w-[640px] animate-monte text-xl leading-[1.55] text-[#4B5A44] delai-400">{t("accroche")}</p>
        <div className="mt-8 flex animate-monte flex-wrap justify-center gap-3.5 delai-400">
          <Suspense
            fallback={
              <Link href="/inscription" className={classeBouton}>
                <IconePiece taille={20} />
                {t("commencer")}
              </Link>
            }
          >
            <BoutonCommencer classe={classeBouton} />
          </Suspense>
          <a href="#marches" className="flex h-[58px] items-center gap-2.5 rounded-2xl border-2 border-foret bg-white px-7 text-[17px] font-bold">
            <IconeLecture />
            {t("voirEnDirect")}
          </a>
        </div>

        <div className="mt-16 flex w-full animate-monte flex-wrap items-start justify-center gap-9 delai-600">
          <Suspense fallback={<div className="h-[420px] max-w-[470px] flex-[1_1_400px] rounded-[28px] bg-vert-clair" />}>
            <CarteSoki />
          </Suspense>
          <Suspense fallback={<div className="h-[360px] max-w-[470px] flex-[1_1_400px] rounded-[28px] bg-hunter" />}>
            <CarteAssistant />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<div className="h-[78px] border-t-2 border-foret bg-hunter" />}>
        <Bandeau />
      </Suspense>
    </section>
  );
}

// Petite courbe du OUI pour la carte « Soki du jour »
function pointsCourbe(valeurs: number[], largeur: number, hauteur: number) {
  const v = valeurs.length >= 2 ? valeurs : [valeurs[0] ?? 50, valeurs[0] ?? 50];
  return v
    .map((p, i) => `${Math.round((i / (v.length - 1)) * largeur)},${Math.round(hauteur - 6 - (p / 100) * (hauteur - 12))}`)
    .join(" ");
}

async function CarteSoki() {
  const m = await marcheDuJour();
  if (!m) return null;
  const t = await getTranslations("accueil");
  const historique = (await historiqueMarche(m.id)).slice(-12).map((p) => p.pourcentage);
  const debut = historique[0] ?? m.pourcentageOui;

  return (
    <article className="max-w-[470px] flex-[1_1_400px] -rotate-[2.5deg] rounded-[28px] border-2 border-foret bg-white p-[26px] text-left shadow-[12px_12px_0_#6A994E]">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border-2 border-foret bg-brique px-3 py-1.5 text-[13px] font-bold text-white">{t("sokiDuJour")}</span>
        <span className="text-[13px] font-semibold text-[#4B5A44]">{m.finLibelle}</span>
      </div>
      <h2 className="mt-[18px] text-[27px] leading-[1.15]">
        <Link href={`/marches/${m.id}`}>{m.question}</Link>
      </h2>
      <div className="mt-5 flex items-end justify-between">
        <div>
          <div className="font-titre text-[58px] font-bold leading-none">{m.pourcentageOui} %</div>
          <div className="mt-1 text-sm text-[#4B5A44]">{t("pensentOui")}</div>
        </div>
        <svg width="150" height="56" viewBox="0 0 150 56" role="img" aria-label={t("courbeLibelle", { debut: Math.round(debut), fin: m.pourcentageOui })}>
          <polyline points={pointsCourbe(historique, 150, 56)} fill="none" stroke="#A7C957" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="mt-4 flex">
        <BarrePourcentage pourcentage={m.pourcentageOui} variante="epaisse" animee couleurOui="vert-jaune" />
      </div>
      <div className="mt-[18px] grid grid-cols-2 gap-2.5">
        <Link href={`/marches/${m.id}?choix=oui`} className="flex h-[52px] items-center justify-center rounded-champ border-2 border-foret bg-vert-jaune text-base font-bold">
          OUI · {m.pourcentageOui} %
        </Link>
        <Link href={`/marches/${m.id}?choix=non`} className="flex h-[52px] items-center justify-center rounded-champ border-2 border-foret bg-brique text-base font-bold text-white">
          NON · {100 - m.pourcentageOui} %
        </Link>
      </div>
      <div className="mt-3.5 flex justify-between text-[13px] text-[#4B5A44]">
        <span>
          {formaterNombre(m.volume)} {t("piecesMisees")}
        </span>
        {m.auteur && <span>{t("parAuteur", { nom: m.auteur })}</span>}
      </div>
    </article>
  );
}

// Carte de présentation de l'assistant (il arrive à l'étape 5) : exemple de conversation en lingala
async function CarteAssistant() {
  const m = await marcheDuJour();
  const t = await getTranslations("accueil");
  const pct = m?.pourcentageOui ?? 50;

  return (
    <article className="max-w-[470px] flex-[1_1_400px] rotate-2 rounded-[28px] border-2 border-foret bg-hunter p-6 text-left text-white shadow-[12px_12px_0_#BC4749]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-bouton bg-vert-jaune">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F3A26" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </span>
          <div>
            <div className="text-[15px] font-bold">{t("assistantNom")}</div>
            <div className="text-xs text-sauge">{t("assistantLangue")}</div>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-[#2A4A31] px-2.5 py-[5px] text-xs font-bold text-champagne">
          <span className="size-2 animate-pulse-direct rounded-full bg-[#FF6B6E]" />
          {t("bientot")}
        </span>
      </div>
      <div className="mt-[18px] flex flex-col gap-2.5">
        <div className="max-w-[82%] animate-bulle self-end rounded-[16px_16px_4px_16px] bg-vert-jaune px-3.5 py-[11px] text-sm leading-[1.4] text-foret delai-1200">
          <strong>{t("assistantQuestion")}</strong>
          <br />
          <span className="text-xs">{t("assistantQuestionTraduction")}</span>
        </div>
        <div className="max-w-[88%] animate-bulle rounded-[16px_16px_16px_4px] bg-white px-3.5 py-[11px] text-sm leading-[1.4] text-foret delai-2200">
          <strong>{t("assistantReponse", { pct })}</strong>
          <br />
          <span className="text-xs">{t("assistantReponseTraduction", { pct })}</span>
        </div>
        <div className="animate-bulle self-end rounded-[14px] border-2 border-vert-jaune bg-white px-4 py-2.5 text-sm font-bold text-foret delai-3200">
          {t("assistantMise")}
        </div>
        <div className="flex gap-[5px] px-1 py-1.5" aria-hidden="true">
          <span className="size-2 animate-point rounded-full bg-sauge" />
          <span className="size-2 animate-point rounded-full bg-sauge delai-200" />
          <span className="size-2 animate-point rounded-full bg-sauge delai-400" />
        </div>
      </div>
    </article>
  );
}

// Bandeau vert foncé qui fait défiler les marchés
async function Bandeau() {
  const marches = (await listerMarchesOuverts()).slice(0, 12);
  if (marches.length === 0) return null;
  const t = await getTranslations("accueil");
  const elements = [...marches, ...marches];

  return (
    <div className="relative overflow-hidden border-t-2 border-foret bg-hunter text-white" aria-label={t("marchesEnDirect")}>
      <div className="flex w-max animate-defile gap-3.5 py-[18px]">
        {elements.map((m, i) => (
          <Link
            key={`${m.id}-${i}`}
            href={`/marches/${m.id}`}
            tabIndex={i >= marches.length ? -1 : undefined}
            aria-hidden={i >= marches.length ? true : undefined}
            className="inline-flex items-center gap-2.5 whitespace-nowrap rounded-full bg-[#2A4A31] px-4 py-2.5 text-[15px] font-semibold"
          >
            <span className={`size-2.5 rounded-full ${POINTS_CATEGORIES[m.categorie]}`} />
            {m.question}
            <strong className="text-vert-jaune">OUI {m.pourcentageOui} %</strong>
          </Link>
        ))}
      </div>
    </div>
  );
}
