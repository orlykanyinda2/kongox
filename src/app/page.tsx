import { Suspense } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { HeroMobile, HeroOrdinateur } from "@/components/accueil/Hero";
import { BandeauPartenaires, CeQuePenseKinshasa, CommentCaMarche } from "@/components/accueil/Sections";
import { ClassementSemaine, MatchsAVenirAccueil } from "@/components/accueil/Football";
import { SectionPourToi, SectionsFil } from "@/components/accueil/Fil";
import { BonusQuotidien } from "@/components/compte/BonusQuotidien";
import { IconePlus } from "@/components/icones";
import { utilisateurConnecte } from "@/lib/compte/session";

// Page d'accueil (maquettes Main.dc.html et Mobile.dc.html).
export default function Accueil() {
  const t = useTranslations("accueil");

  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <main className="flex-1">
        <Suspense fallback={null}>
          <BonusSiConnecte />
        </Suspense>

        <HeroMobile />
        <HeroOrdinateur />

        <section id="marches" className="mx-auto max-w-contenu scroll-mt-20 px-[18px] pb-6 pt-[18px] md:px-6 md:pt-16">
          <div className="mb-10 hidden flex-wrap items-end justify-between gap-4 md:flex">
            <div>
              <h2 className="text-[40px] tracking-[-1px]">{t("marchesEnDirect")}</h2>
              <p className="mt-2 text-base text-texte-secondaire">{t("tendancesTexte")}</p>
            </div>
            <Link href="/proposer" className="flex h-11 items-center gap-2 rounded-bouton border border-separateur bg-surface px-[18px] text-[15px] font-bold text-texte">
              <IconePlus />
              {t("proposer")}
            </Link>
          </div>

          <Suspense fallback={null}>
            <SectionPourToi />
          </Suspense>
          <Suspense fallback={<ChargementListe />}>
            <SectionsFil />
          </Suspense>
        </section>

        <Suspense fallback={null}>
          <MatchsAVenirAccueil />
        </Suspense>

        <section id="classement" className="mx-auto flex max-w-contenu flex-wrap gap-6 px-[18px] pb-6 pt-10 md:px-6 md:pt-14">
          <Suspense fallback={<div className="h-80 min-w-0 flex-[1_1_420px] animate-pulse rounded-[24px] bg-doux" />}>
            <ClassementSemaine />
          </Suspense>
          <Suspense fallback={null}>
            <CeQuePenseKinshasa />
          </Suspense>
        </section>
        <CommentCaMarche />
        <BandeauPartenaires />
      </main>
      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}

function ChargementListe() {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[220px] animate-pulse rounded-carte bg-doux" />
      ))}
    </div>
  );
}

async function BonusSiConnecte() {
  const u = await utilisateurConnecte();
  if (!u) return null;
  return (
    <div className="mx-auto max-w-contenu px-[18px] pt-4 md:px-6">
      <BonusQuotidien utilisateurId={u.id} />
    </div>
  );
}
