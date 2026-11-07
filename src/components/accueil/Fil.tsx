import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CarteMarche } from "@/components/marches/CarteMarche";
import { filAccueil, reglagesFil, type SectionFil } from "@/lib/marches/fil";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { marchesParIds } from "@/lib/marches/donnees";
import { utilisateurConnecte } from "@/lib/compte/session";

// Sections de l'accueil (docs/ALGORITHME.md) : le Soki du jour est dans le grand encadré du haut,
// puis (Pour toi), Tendances, (En forte hausse), Bientôt fermés, (Le Congo est divisé), Nouveaux.
// Un marché n'apparaît qu'une fois. Les sections entre parenthèses (phase 2) sont désactivées par défaut.

const GRILLE = "mt-[18px] grid gap-[18px] md:mt-6 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:gap-4";

async function Section({ section }: { section: SectionFil }) {
  const t = await getTranslations("fil");
  const ta = await getTranslations("accueil");
  const libelles = { pieces: ta("piecesMisees"), partager: ta("partagerWhatsApp"), sponsorise: t("sponsorise") };
  return (
    <section aria-labelledby={`fil-${section.cle}`} className="mt-10 first:mt-0 md:mt-14">
      <h3 id={`fil-${section.cle}`} className="text-[22px] md:text-[32px] md:tracking-[-0.5px]">
        {t(section.cle)}
      </h3>
      <p className="mt-1 text-[15px] text-texte-secondaire md:text-base">{t(`${section.cle}Texte`)}</p>
      <div className={GRILLE}>
        {section.marches.map((m, i) => (
          <CarteMarche key={m.id} marche={m} libelles={libelles} suivi={{ section: section.cle, position: i + 1 }} />
        ))}
      </div>
    </section>
  );
}

export async function SectionsFil() {
  const { sections } = await filAccueil();
  const t = await getTranslations("fil");
  return (
    <>
      {sections.length === 0 ? (
        <p className="mt-6 rounded-carte border-2 border-dashed border-sauge bg-doux p-6 text-center text-[15px]">{t("aucun")}</p>
      ) : (
        sections.map((s) => <Section key={s.cle} section={s} />)
      )}
      <div className="mt-8 flex justify-center md:mt-10">
        <Link
          href="/marches"
          className="flex h-[52px] items-center justify-center rounded-champ border-2 border-contour bg-surface px-6 text-base font-bold text-texte shadow-decale"
        >
          {t("voirTous")}
        </Link>
      </div>
    </>
  );
}

// « Pour toi » (phase 2) : propre à chaque personne connectée, donc hors cache.
// Exclut les marchés déjà présents dans les autres sections.
export async function SectionPourToi() {
  const reglages = await reglagesFil();
  if (reglages.section_pour_toi !== 1) return null;
  const u = await utilisateurConnecte();
  if (!u) return null;
  const { soki, sections } = await filAccueil();
  const deja = [...(soki ? [soki.id] : []), ...sections.flatMap((s) => s.marches.map((m) => m.id))];
  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc("fil_pour_toi", { p_exclure: deja });
  if (error) {
    console.error("[fil] pour toi :", error.message);
    return null;
  }
  const ids = (data ?? []) as number[];
  const parId = new Map((await marchesParIds(ids)).map((m) => [m.id, m]));
  const marches = ids.map((id) => parId.get(id)).filter((m) => !!m);
  if (marches.length === 0) return null;
  return (
    <div className="mb-10 md:mb-14">
      <Section section={{ cle: "pour_toi", titre: "Pour toi", marches }} />
    </div>
  );
}
