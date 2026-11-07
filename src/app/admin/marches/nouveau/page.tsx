import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { EnTetePage } from "@/components/admin/ui";
import { FormulaireMarche } from "@/components/admin/FormulaireMarche";
import { exigerAdmin } from "@/lib/admin/acces";
import { dansJours, partiesKinshasa } from "@/lib/format";

export default function PageNouveauMarche() {
  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre="Nouveau marché"
        description="Créé par l'admin : pas de passage par la file d'approbation."
        actions={
          <Link href="/admin/marches" className="text-[13px] text-adm-secondaire underline">
            ← Tous les marchés
          </Link>
        }
      />
      <Suspense fallback={null}>
        <Formulaire />
      </Suspense>
    </div>
  );
}

async function Formulaire() {
  await exigerAdmin();
  await connection();
  // Par défaut : fermeture dans 7 jours à 20 h, publication demain à 8 h
  const fin = partiesKinshasa(dansJours(7));
  const demain = partiesKinshasa(dansJours(1));
  return (
    <FormulaireMarche
      mode="creation"
      valeurs={{ question: "", categorie: "football", source: "", finDate: fin.jour, finHeure: "20:00", pubDate: demain.jour, pubHeure: "08:00", misEnAvant: false, soki: false }}
    />
  );
}
