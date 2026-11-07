import Link from "next/link";
import type { Marche } from "@/lib/marches/donnees";
import { formaterNombre } from "@/lib/format";
import { lienWhatsApp, texteMarche } from "@/lib/partage";
import { BarrePourcentage } from "./BarrePourcentage";
import { EtiquetteCategorie } from "./EtiquetteCategorie";
import { IconePartage } from "@/components/icones";

// Carte d'un marché (maquettes Main et Mobile).
// Mobile : carte entièrement cliquable avec « OUI xx % ». Ordinateur : boutons OUI / NON.
// suivi : section et position de la carte dans le fil (mesure des affichages et des clics, voir SuiviFil)
export function CarteMarche({
  marche,
  libelles,
  suivi,
}: {
  marche: Marche;
  libelles: { pieces: string; partager: string; sponsorise?: string };
  suivi?: { section: string; position: number };
}) {
  const pct = marche.pourcentageOui;
  const lien = `/marches/${marche.id}`;

  return (
    <article
      data-fil-marche={suivi ? marche.id : undefined}
      data-fil-section={suivi?.section}
      data-fil-position={suivi?.position}
      className="relative flex flex-col gap-3 rounded-[18px] border-2 border-contour bg-surface p-4 shadow-decale md:gap-3.5 md:rounded-carte md:p-[22px] md:shadow-decale-md">
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          <EtiquetteCategorie categorie={marche.categorie} />
          {marche.sponsor && (
            <span className="rounded-full border border-separateur px-2 py-0.5 text-[11px] font-bold text-texte-secondaire" title={marche.sponsor}>
              {libelles.sponsorise ?? "Sponsorisé"}
            </span>
          )}
        </span>
        <span className="text-xs font-semibold text-texte-secondaire md:text-[13px]">{marche.finLibelle}</span>
      </div>

      <h3 className="text-[17px] leading-[1.25] md:min-h-[50px] md:text-xl">
        {/* Le lien couvre toute la carte sur mobile */}
        <Link href={lien} className="after:absolute after:inset-0 after:rounded-[18px] md:after:hidden">
          {marche.question}
        </Link>
      </h3>

      <div className="flex items-center gap-2.5 md:gap-3">
        <BarrePourcentage pourcentage={pct} />
        <span className="text-sm font-bold text-texte md:text-[15px] md:text-hunter md:dark:text-vert-jaune">
          <span className="md:hidden">OUI </span>
          {pct} %
        </span>
      </div>

      <div className="hidden grid-cols-2 gap-2 md:grid">
        <Link
          href={`${lien}?choix=oui`}
          className="flex h-[46px] items-center justify-center rounded-bouton bg-oui-fond text-[15px] font-bold text-oui-texte"
        >
          OUI · {pct} %
        </Link>
        <Link
          href={`${lien}?choix=non`}
          className="flex h-[46px] items-center justify-center rounded-bouton bg-non-fond text-[15px] font-bold text-non-texte"
        >
          NON · {100 - pct} %
        </Link>
      </div>

      <div className="flex items-center justify-between text-xs text-texte-secondaire md:border-t md:border-separateur md:pt-3 md:text-[13px]">
        <span className="flex flex-col">
          <span>
            {formaterNombre(marche.volume)} {libelles.pieces}
          </span>
          {/* Rempli après l'affichage pour une personne connectée (SuivisSurCartes) */}
          <span data-suivis-marche={marche.id} />
        </span>
        <a
          href={lienWhatsApp(texteMarche(marche.question, pct, marche.id))}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={libelles.partager}
          className="relative z-10 hidden size-9 items-center justify-center rounded-[10px] border border-separateur text-texte-secondaire md:flex"
        >
          <IconePartage />
        </a>
      </div>
    </article>
  );
}
