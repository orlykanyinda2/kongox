import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { ChoixIcone, type IconeListe } from "@/components/profil/ChoixIcone";
import { IconeRetour } from "@/components/icones";
import { utilisateurConnecte } from "@/lib/compte/session";
import { creerClientServeur } from "@/lib/supabase/serveur";

export const metadata = { title: "Mon icône — KongoX" };

// Profil › Mon icône : icônes gratuites, élite (badge), boutique (pièces gratuites) et photo perso
export default function PageIcone() {
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <main className="mx-auto w-full max-w-contenu flex-1 px-[18px] pb-28 pt-5 md:px-6 md:pb-12">
        <Link href="/profil" className="inline-flex h-11 items-center gap-1 rounded-bouton pr-3 text-sm font-semibold text-texte-secondaire">
          <IconeRetour taille={18} />
          Mon profil
        </Link>
        <h1 className="mt-1 text-[30px] tracking-[-0.5px] md:text-[38px]">Mon icône</h1>
        <p className="mb-5 mt-1 text-[15px] text-texte-secondaire">Elle s&apos;affiche à côté de ton pseudo partout : votes, classement, commentaires.</p>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-carte bg-doux" />}>
          <Contenu />
        </Suspense>
      </main>
      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}

async function Contenu() {
  const u = await utilisateurConnecte();
  if (!u) redirect("/connexion");
  const { data } = await (await creerClientServeur()).rpc("mes_icones");
  const icones = ((data ?? []) as (IconeListe & { prix: number | string })[]).map((i) => ({ ...i, prix: Number(i.prix) }));
  return (
    <ChoixIcone utilisateurId={u.id} nom={u.nom_utilisateur} actuelle={u.icone} photo={u.photo} solde={u.solde_pieces} invite={u.invite} icones={icones} />
  );
}
