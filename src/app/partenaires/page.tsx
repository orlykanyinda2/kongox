import { Suspense } from "react";
import Link from "next/link";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { FormulairePartenaire } from "@/components/partenaires/FormulairePartenaire";
import { IconeWhatsApp } from "@/components/icones";
import { OFFRES, estTypePartenariat } from "@/lib/partenaires";
import { OPEN_GRAPH, lienWhatsAppEquipe } from "@/lib/partage";
import type { Metadata } from "next";
import { lireReglages } from "@/lib/reglages";

const DESCRIPTION = "Marques, sponsors de cadeaux, curateurs, influenceurs, médias : collaborez avec KongoX, le marché des prédictions du Congo.";
export const metadata: Metadata = {
  title: "Devenir partenaire — KongoX",
  description: DESCRIPTION,
  openGraph: { ...OPEN_GRAPH, title: "Devenir partenaire de KongoX", description: DESCRIPTION, url: "/partenaires" },
};

// « Devenir partenaire de KongoX » (maquettes/Partenaires.dc.html)
export default function PagePartenaires({ searchParams }: PageProps<"/partenaires">) {
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <div className="relative flex-1 overflow-hidden">
        <div aria-hidden="true" className="absolute left-[5%] top-14 size-[70px] animate-flotte rounded-full border-[16px] border-vert-jaune" />
        <div aria-hidden="true" className="absolute right-[7%] top-24 size-14 animate-tourne rounded-2xl border-2 border-foret bg-brique" />
        <div aria-hidden="true" className="absolute -right-16 top-[420px] hidden size-[200px] animate-flotte-lent rounded-full bg-sauge md:block" />

        <main className="relative mx-auto max-w-contenu px-[18px] pb-28 pt-10 md:px-6 md:pb-16 md:pt-14">
          <div className="text-center">
            <span className="inline-flex animate-monte items-center gap-2 rounded-full border-2 border-contour py-2 pl-2.5 pr-3.5 text-sm font-bold">
              <span className="size-2.5 animate-pulse-direct rounded-full bg-brique" />
              Devenir partenaire de KongoX
            </span>
            <h1 className="mt-6 animate-monte text-[clamp(42px,6.4vw,92px)] leading-[0.95] tracking-[-2.5px] delai-200">
              Grandissons ensemble.
              <br />
              <span className="mt-3 inline-block animate-rebond rounded-[32px] border-4 border-foret bg-vert-jaune px-[30px] pb-2.5 pt-0.5 text-foret shadow-[9px_9px_0_#1F3A26]">
                Gagnez avec nous.
              </span>
            </h1>
            <p className="mx-auto mt-8 max-w-[620px] animate-monte text-lg leading-[1.55] text-texte-secondaire delai-400">
              Marques, curateurs, influenceurs, médias : il y a une place pour vous dans la communauté KongoX. Choisissez votre façon de collaborer.
            </p>
          </div>

          <section aria-label="Les offres" className="mt-14 grid animate-monte grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-[22px] delai-600">
            {OFFRES.map((o, i) => (
              <article key={o.type} className={`flex flex-col gap-3 rounded-[22px] border-2 border-contour bg-surface p-6 ${o.ombre}`}>
                <span className="flex size-11 items-center justify-center rounded-xl border-2 border-contour bg-doux font-titre text-lg font-bold">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="text-[21px]">{o.titre}</h2>
                <p className="text-[15px] leading-normal">{o.texte}</p>
                <p className="rounded-xl bg-cat-vie-fond px-3 py-2.5 text-sm leading-[1.45] text-hunter">
                  <strong>Ce que vous gagnez :</strong> {o.gain}
                </p>
                <Link
                  href={o.lien ?? `/partenaires?type=${o.type}#contact`}
                  data-type-partenariat={o.lien ? undefined : o.type}
                  className="mt-auto flex h-[46px] items-center justify-center rounded-xl border-2 border-foret bg-foret text-[15px] font-bold text-white dark:border-vert-jaune"
                >
                  {o.bouton}
                </Link>
              </article>
            ))}
          </section>

          <section
            id="contact"
            aria-labelledby="contact-titre"
            className="mt-16 flex scroll-mt-24 flex-wrap gap-8 rounded-[28px] border-2 border-foret bg-hunter p-6 text-white shadow-[10px_10px_0_#A7C957] md:p-9"
          >
            <div className="min-w-0 flex-[1_1_320px]">
              <h2 id="contact-titre" className="text-[32px] leading-[1.05] tracking-[-1px] md:text-[38px]">
                Parlons de votre projet.
              </h2>
              <p className="mt-3.5 text-base leading-normal text-[#E4EAD3]">Remplissez le formulaire ou écrivez-nous directement sur WhatsApp. On vous répond sous 48 h.</p>
              <Suspense fallback={null}>
                <BoutonWhatsApp />
              </Suspense>
              <p className="mt-6 text-sm text-[#E4EAD3]">Jeu gratuit : KongoX n&apos;utilise jamais d&apos;argent réel pour les prédictions.</p>
            </div>
            <Suspense fallback={<div className="min-h-[420px] flex-[1_1_420px]" />}>
              <Formulaire searchParams={searchParams} />
            </Suspense>
          </section>
        </main>
      </div>
      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}

async function Formulaire({ searchParams }: { searchParams: PageProps<"/partenaires">["searchParams"] }) {
  const { type } = await searchParams;
  return <FormulairePartenaire typeInitial={estTypePartenariat(type) ? type : "marque"} />;
}

async function BoutonWhatsApp() {
  const lien = lienWhatsAppEquipe(String((await lireReglages()).whatsapp_equipe ?? ""), "Bonjour KongoX, je voudrais devenir partenaire. ");
  if (!lien) return null;
  return (
    <a
      href={lien}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-5 inline-flex h-[52px] items-center gap-2.5 rounded-champ border-2 border-foret bg-vert-jaune px-[22px] text-base font-bold text-foret"
    >
      <IconeWhatsApp />
      Écrire sur WhatsApp
    </a>
  );
}
