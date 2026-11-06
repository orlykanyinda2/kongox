import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { FormulaireProposition } from "@/components/marches/FormulaireProposition";
import { utilisateurConnecte } from "@/lib/compte/session";

export const metadata = { title: "Proposer une question — KongoX" };

// « Proposer une question » (maquettes/Proposer.dc.html). Réservé aux comptes connectés.
export default function PageProposer() {
  const t = useTranslations("proposer");
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-[18px] pb-28 pt-6 md:pb-14">
        <h1 className="mb-[18px] text-[28px] tracking-[-0.5px]">{t("titre")}</h1>
        <Suspense fallback={<div className="h-[900px] animate-pulse rounded-carte bg-doux" />}>
          <Formulaire />
        </Suspense>
      </main>
      <BarreNavigation />
    </div>
  );
}

// Jour (AAAA-MM-JJ) à Kinshasa, décalé de n jours
function jour(decalageJours: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kinshasa" }).format(new Date(Date.now() + decalageJours * 86_400_000));
}

async function Formulaire() {
  await connection(); // les dates limites dépendent du jour de la visite
  const u = await utilisateurConnecte();
  if (!u) redirect("/connexion");
  // Entre demain + 1 jour (24 h minimum) et 2 ans (mêmes limites que la fonction SQL)
  return <FormulaireProposition dateMin={jour(2)} dateMax={jour(729)} />;
}
