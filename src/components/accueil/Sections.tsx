import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { IconeWhatsApp } from "@/components/icones";
import { listerMarchesOuverts } from "@/lib/marches/donnees";
import { lienWhatsApp, texteMarche } from "@/lib/partage";

// « Ce que pense Kinshasa » : le marché vie quotidienne ou politique le plus misé (hors Soki du jour)
export async function CeQuePenseKinshasa() {
  const marches = await listerMarchesOuverts();
  const m = marches.find((x) => !x.soki_du_jour && (x.categorie === "vie_quotidienne" || x.categorie === "politique"));
  if (!m) return null;
  const t = await getTranslations("accueil");

  return (
    <section className="mx-auto hidden max-w-contenu px-6 pb-6 pt-14 md:block">
      <div className="flex flex-col gap-4 rounded-[24px] border-2 border-foret bg-vert-jaune p-7 text-foret shadow-[8px_8px_0_#BC4749]">
        <span className="text-sm font-bold tracking-[1px]">{t("kinshasaSurtitre")}</span>
        <h2 className="text-4xl leading-[1.1] tracking-[-1px]">« {t("kinshasaCitation", { pct: m.pourcentageOui })} »</h2>
        <p className="font-titre text-xl font-bold">
          <Link href={`/marches/${m.id}`} className="underline decoration-2 underline-offset-4">
            {m.question}
          </Link>
        </p>
        <p className="text-base leading-normal">{t("kinshasaTexte")}</p>
        <div className="mt-auto flex flex-wrap gap-2.5">
          <a
            href={lienWhatsApp(texteMarche(m.question, m.pourcentageOui, m.id))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center gap-2 rounded-bouton bg-foret px-5 text-[15px] font-bold text-white"
          >
            <IconeWhatsApp />
            {t("partagerWhatsApp")}
          </a>
        </div>
      </div>
    </section>
  );
}

export function CommentCaMarche() {
  const t = useTranslations("accueil");
  const etapes = [1, 2, 3] as const;
  return (
    <section className="mx-auto hidden max-w-contenu px-6 pb-6 pt-14 md:block">
      <h2 className="text-[40px] tracking-[-1px]">{t("commentTitre")}</h2>
      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        {etapes.map((n) => (
          <div key={n} className="rounded-carte border-2 border-contour bg-surface p-6 shadow-decale-md">
            <div className="flex size-11 items-center justify-center rounded-bouton bg-foret font-titre text-xl font-bold text-vert-jaune">{n}</div>
            <h3 className="mt-4 text-[21px]">{t(`etape${n}Titre`)}</h3>
            <p className="mt-2 text-[15px] leading-normal text-texte-secondaire">{t(`etape${n}Texte`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BandeauPartenaires() {
  const t = useTranslations("accueil");
  return (
    <section id="partenaires" className="mx-auto hidden max-w-contenu px-6 pb-[72px] pt-14 md:block">
      <div className="flex flex-wrap items-center gap-8 rounded-[28px] border-2 border-foret bg-hunter p-10 text-white shadow-[10px_10px_0_#A7C957]">
        <div className="min-w-0 flex-[999_1_420px]">
          <span className="text-sm font-bold tracking-[1px] text-vert-jaune">{t("partenairesSurtitre")}</span>
          <h2 className="mt-2.5 text-[40px] leading-[1.05] tracking-[-1px]">{t("partenairesTitre")}</h2>
          <p className="mt-3.5 text-[17px] leading-normal text-[#E4EAD3]">{t("partenairesTexte")}</p>
        </div>
        <div className="flex flex-[1_1_260px] flex-col gap-2.5">
          <Link href="/partenaires" className="flex h-[54px] items-center justify-center rounded-champ bg-vert-jaune px-[22px] text-base font-bold text-foret">
            {t("voirOffres")}
          </Link>
          <Link href="/partenaires" className="flex h-[54px] items-center justify-center rounded-champ border-2 border-sauge px-[22px] text-base font-bold text-white">
            {t("devenirCurateur")}
          </Link>
        </div>
      </div>
    </section>
  );
}
