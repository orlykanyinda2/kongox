import { Suspense } from "react";
import Link from "next/link";
import { after } from "next/server";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { CarteMatch } from "@/components/football/CarteMatch";
import { liguesActives, matchsAVenir, resultatsRecents, type MatchAffiche } from "@/lib/football/donnees";
import { importerSiBesoin } from "@/lib/football/import";

export const metadata = { title: "Football — KongoX" };

// Matchs à venir (1 N 2) et derniers résultats, par championnat. Heures de Kinshasa.
export default function PageFootball({ searchParams }: PageProps<"/football">) {
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <main className="mx-auto w-full max-w-contenu flex-1 px-[18px] pb-10 pt-6 md:px-6">
        <h1 className="text-[32px] tracking-[-1px] md:text-[40px]">Football</h1>
        <p className="mt-1.5 text-[15px] text-texte-secondaire">Choisis 1, N ou 2 avec tes pièces gratuites. Heures de Kinshasa. Gains versés automatiquement après le match.</p>
        <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-carte bg-doux" />}>
          <Contenu searchParams={searchParams} />
        </Suspense>
      </main>
      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}

const jourTitre = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Kinshasa" });
const jourCle = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kinshasa" }).format(new Date(iso));

function parJour(matchs: MatchAffiche[]) {
  const groupes = new Map<string, MatchAffiche[]>();
  for (const m of matchs) groupes.set(jourCle(m.date_match), [...(groupes.get(jourCle(m.date_match)) ?? []), m]);
  return [...groupes.entries()];
}

async function Contenu({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const ligue = Number(params.ligue) || undefined;
  // Vérifie en arrière-plan s'il faut importer (après l'envoi de la page : la visite n'attend pas)
  after(importerSiBesoin);
  const [ligues, aVenir, resultats] = await Promise.all([liguesActives(), matchsAVenir(60, ligue), resultatsRecents(12, ligue)]);

  const puce = (id: number | undefined, nom: string) => (
    <Link
      key={nom}
      href={id ? `/football?ligue=${id}` : "/football"}
      aria-current={ligue === id ? "page" : undefined}
      className={`flex h-11 flex-none items-center rounded-full border px-4 text-[15px] font-bold ${
        ligue === id ? "border-foret bg-foret text-white dark:border-vert-jaune dark:bg-vert-jaune dark:text-foret" : "border-separateur bg-surface text-texte"
      }`}
    >
      {nom}
    </Link>
  );

  return (
    <>
      <nav aria-label="Championnats" className="-mx-[18px] mt-5 flex gap-2 overflow-x-auto px-[18px] pb-1 md:mx-0 md:flex-wrap md:px-0">
        {puce(undefined, "Tous")}
        {ligues.map((l) => puce(l.id, l.nom))}
      </nav>

      <section className="mt-6 flex flex-col gap-6" aria-label="Matchs à venir">
        {aVenir.length === 0 && (
          <p className="rounded-carte border-2 border-dashed border-sauge bg-doux p-6 text-center text-[15px]">
            Aucun match à venir pour l&apos;instant. Les matchs de la semaine sont importés chaque jour.
          </p>
        )}
        {parJour(aVenir).map(([j, matchs]) => (
          <div key={j}>
            <h2 className="mb-3 text-xl capitalize">{jourTitre.format(new Date(`${j}T12:00:00+01:00`))}</h2>
            <div className="grid gap-4 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
              {matchs.map((m) => (
                <CarteMatch key={m.id} m={m} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {resultats.length > 0 && (
        <section className="mt-10" aria-label="Derniers résultats">
          <h2 className="mb-3 text-2xl">Derniers résultats</h2>
          <div className="grid gap-4 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
            {resultats.map((m) => (
              <CarteMatch key={m.id} m={m} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
