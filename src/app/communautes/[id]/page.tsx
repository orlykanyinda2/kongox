import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { SalonServeur } from "@/components/chat/SalonServeur";
import { BoutonSocial } from "@/components/social/BoutonSocial";
import { IconeRetour } from "@/components/icones";
import { rejoindreCommunaute } from "@/app/actions/social";
import { creerClientPublic } from "@/lib/supabase/public";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { utilisateurConnecte } from "@/lib/compte/session";
import { formaterNombre } from "@/lib/format";
import { OPEN_GRAPH, urlSite } from "@/lib/partage";
import type { Metadata } from "next";
import { BoutonsPartage } from "@/components/social/BoutonsPartage";

export async function generateMetadata({ params }: PageProps<"/communautes/[id]">): Promise<Metadata> {
  const numero = Number((await params).id);
  if (!Number.isInteger(numero) || numero <= 0) return {};
  const { data } = await creerClientPublic().from("communautes").select("nom, description").eq("id", numero).eq("active", true).maybeSingle<{ nom: string; description: string | null }>();
  if (!data) return { robots: { index: false } };
  const description = data.description ?? `Le salon de la communauté ${data.nom} sur KongoX.`;
  return { title: `${data.nom} — KongoX`, description, openGraph: { ...OPEN_GRAPH, title: `${data.nom} sur KongoX`, description, url: `/communautes/${numero}` } };
}

// Page d'une communauté : présentation, bouton Rejoindre, salon de discussion en direct.
export default function PageCommunaute({ params }: PageProps<"/communautes/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-[18px] pb-28 pt-5 md:pb-12">
        <Link href="/chat" className="inline-flex h-11 items-center gap-1 rounded-bouton pr-3 text-sm font-semibold text-texte-secondaire">
          <IconeRetour taille={18} />
          Chat
        </Link>
        <Suspense fallback={<div className="mt-2 h-96 animate-pulse rounded-carte bg-doux" />}>
          <Contenu params={params} />
        </Suspense>
      </main>
      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}

const TYPES: Record<string, string> = { ville: "Ville", universite: "Université", fan_club: "Fan-club", autre: "Communauté" };

async function Contenu({ params }: { params: PageProps<"/communautes/[id]">["params"] }) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  const db = creerClientPublic();
  const [{ data: c }, { count }, u] = await Promise.all([
    db.from("communautes").select("id, nom, type, description, active").eq("id", numero).maybeSingle<{ id: number; nom: string; type: string; description: string | null; active: boolean }>(),
    db.from("membres_communaute").select("utilisateur_id", { count: "exact", head: true }).eq("communaute_id", numero),
    utilisateurConnecte(),
  ]);
  if (!c || !c.active) notFound();

  let membre = false;
  if (u) {
    const { data } = await (await creerClientServeur()).from("membres_communaute").select("utilisateur_id").eq("communaute_id", numero).eq("utilisateur_id", u.id).maybeSingle();
    membre = Boolean(data);
  }

  return (
    <>
      <header className="mt-2 flex flex-wrap items-end justify-between gap-4 rounded-carte border-2 border-contour bg-surface p-5 shadow-decale-md">
        <div className="min-w-0">
          <span className="rounded-full bg-doux px-2.5 py-1 text-xs font-bold">{TYPES[c.type] ?? TYPES.autre}</span>
          <h1 className="mt-2 text-[28px] leading-tight tracking-[-0.5px] md:text-[34px]">{c.nom}</h1>
          {c.description && <p className="mt-1.5 text-[15px] text-texte-secondaire">{c.description}</p>}
          <p className="mt-1.5 text-sm text-texte-secondaire">
            {formaterNombre(count ?? 0)} membre{(count ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
        {u && !u.invite ? (
          <BoutonSocial action={rejoindreCommunaute.bind(null, c.id)} actif={membre} libelleActif="Quitter" libelleInactif="Rejoindre" />
        ) : (
          <Link href="/inscription" className="flex h-12 items-center rounded-champ border-2 border-foret bg-foret px-[22px] text-[15px] font-bold text-white">
            Rejoindre
          </Link>
        )}
      </header>

      <div className="mt-4">
        <BoutonsPartage url={`${urlSite()}/communautes/${c.id}`} texte={`Rejoins la communauté ${c.nom} sur KongoX : on prédit ensemble, avec des pièces gratuites.`} />
      </div>

      <div className="mt-6">
        <Suspense fallback={<div className="h-48 animate-pulse rounded-[18px] bg-doux" />}>
          <SalonServeur cible={{ communaute: c.id }} type="communaute" />
        </Suspense>
      </div>
    </>
  );
}
