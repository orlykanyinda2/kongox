import { Suspense } from "react";
import Link from "next/link";
import { Menu, type Compteurs } from "@/components/admin/Menu";
import { lireAcces } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { lireReglages } from "@/lib/reglages";

export const metadata = { title: "Administration — KongoX", robots: { index: false } };

// Back-office (DESIGN.md « Panneau admin ») : barre du haut avec recherche globale,
// menu latéral fixe (replié derrière « Menu » sur téléphone), contenu dense.
export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  return (
    <div className="adm flex min-h-screen flex-1 flex-col bg-adm-fond text-sm text-adm-texte">
      <header className="sticky top-0 z-30 border-b border-adm-bordure bg-white">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/admin" className="whitespace-nowrap text-[15px] font-semibold">
            KongoX <span className="font-normal text-adm-secondaire">· Administration</span>
          </Link>
          <form action="/admin/recherche" method="get" role="search" className="ml-2 hidden max-w-md flex-1 sm:block">
            <label htmlFor="recherche-globale" className="sr-only">
              Rechercher un utilisateur ou un marché
            </label>
            <input
              id="recherche-globale"
              name="q"
              type="search"
              placeholder="Rechercher un utilisateur ou un marché…"
              className="h-9 w-full rounded-md border border-adm-bordure bg-adm-zone px-3 text-sm outline-none focus:border-adm-accent focus:bg-white"
            />
          </form>
          <span className="flex-1" />
          <Suspense fallback={null}>
            <Connecte />
          </Suspense>
          <Link href="/" className="hidden text-[13px] text-adm-secondaire underline md:inline">
            Voir le site
          </Link>
        </div>
        {/* Téléphone : recherche et menu repliés */}
        <details className="border-t border-adm-bordure md:hidden">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-semibold">☰ Menu</summary>
          <div className="flex flex-col gap-3 bg-adm-zone px-3 pb-3">
            <form action="/admin/recherche" method="get" role="search">
              <input
                name="q"
                type="search"
                aria-label="Rechercher un utilisateur ou un marché"
                placeholder="Rechercher…"
                className="h-9 w-full rounded-md border border-adm-bordure bg-white px-3 text-sm"
              />
            </form>
            <Suspense fallback={null}>
              <MenuDonnees />
            </Suspense>
          </div>
        </details>
      </header>

      <Suspense fallback={null}>
        <BandeauTest />
      </Suspense>

      <div className="flex flex-1">
        <aside className="hidden w-56 flex-none border-r border-adm-bordure bg-adm-zone md:block">
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto p-3">
            <Suspense fallback={null}>
              <MenuDonnees />
            </Suspense>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}

// Tant que la saison importée n'est pas la saison réelle, on le dit clairement
async function BandeauTest() {
  const acces = await lireAcces();
  if (!acces?.admin) return null;
  const r = await lireReglages();
  const decalage = Number(r.football_decalage_jours);
  if (decalage <= 0) return null;
  return (
    <div role="status" className="border-b border-[#eedfb8] bg-[#fbf4e4] px-4 py-2 text-[13px]">
      <strong>Données de test {String(r.football_saison)}</strong> : les matchs de la saison {String(r.football_saison)} sont rejoués avec un décalage de {decalage} jours.
      Avant la mise en ligne : offre payante d&apos;API-Football, puis <Link href="/admin/reglages" className="underline">saison en cours et décalage 0</Link>.
    </div>
  );
}

async function Connecte() {
  const acces = await lireAcces();
  if (!acces) return null;
  return (
    <span className="whitespace-nowrap text-[13px] text-adm-secondaire">
      @<strong className="text-adm-texte">{acces.utilisateur.nom_utilisateur}</strong> · {acces.admin ? "admin" : "curateur"}
    </span>
  );
}

async function MenuDonnees() {
  const acces = await lireAcces();
  if (!acces) return null;
  let compteurs: Compteurs = {};
  if (acces.admin) {
    const supabase = await creerClientServeur();
    const [{ data: s }, { data: tb }, { count: signalements }] = await Promise.all([
      supabase.rpc("statistiques_admin"),
      supabase.rpc("tableau_de_bord"),
      supabase.from("signalements").select("id", { count: "exact", head: true }).eq("statut", "ouvert"),
    ]);
    const st = s as { en_attente: number; a_regler: number; cadeaux: number; candidatures: number; decisions: number } | null;
    compteurs = {
      approbation: st?.en_attente,
      resultats: st?.a_regler,
      cadeaux: st?.cadeaux,
      curateurs: (st?.candidatures ?? 0) + (st?.decisions ?? 0),
      programmation: (tb as { programmes: number } | null)?.programmes,
      signalements: signalements ?? 0,
    };
  }
  return <Menu admin={acces.admin} compteurs={compteurs} />;
}
