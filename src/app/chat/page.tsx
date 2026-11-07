import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { AssistantServeur } from "@/components/ia/AssistantServeur";
import { matchsAVenir } from "@/lib/football/donnees";
import { creerClientPublic } from "@/lib/supabase/public";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { utilisateurConnecte } from "@/lib/compte/session";
import { formaterNombre } from "@/lib/format";

export const metadata = { title: "Chat — KongoX" };

// Onglet « Chat » de la barre du bas : l'assistant KongoX et la liste des salons
// (communautés, matchs à venir, marchés où ça discute le plus).
export default function PageChat() {
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <main className="mx-auto w-full max-w-[640px] flex-1 px-[18px] pb-28 pt-6 md:pb-12">
        <h1 className="text-[28px] tracking-[-0.5px] md:text-[34px]">Chat</h1>
        <p className="mb-5 mt-1.5 text-[15px] text-texte-secondaire">
          Pose tes questions à l&apos;assistant KongoX en lingala, swahili, français ou anglais, ou discute avec la communauté dans les salons.
        </p>
        <Suspense fallback={<div className="h-80 animate-pulse rounded-[18px] bg-doux" />}>
          <AssistantServeur grand />
        </Suspense>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-[18px] bg-doux" />}>
          <Salons />
        </Suspense>
      </main>
      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}

const LIGNE = "flex min-h-14 items-center justify-between gap-3 rounded-bouton border-2 border-contour bg-surface px-3.5 py-2.5";

async function Salons() {
  await connection();
  const db = creerClientPublic();
  const [u, matchs, { data: communautes }, { data: discutes }] = await Promise.all([
    utilisateurConnecte(),
    matchsAVenir(12),
    db.from("communautes").select("id, nom").eq("active", true).order("nom").limit(30),
    db
      .from("scores_marches")
      .select("marche_id, commentaires_24h, marche:marches!scores_marches_marche_id_fkey(question)")
      .gt("commentaires_24h", 0)
      .order("commentaires_24h", { ascending: false })
      .limit(5)
      .returns<{ marche_id: number; commentaires_24h: number; marche: { question: string } | null }[]>(),
  ]);

  let miennes = new Set<number>();
  if (u) {
    const { data } = await (await creerClientServeur()).from("membres_communaute").select("communaute_id").eq("utilisateur_id", u.id);
    miennes = new Set((data ?? []).map((m: { communaute_id: number }) => m.communaute_id));
  }
  const liste = [...(communautes ?? [])].sort((a, b) => Number(miennes.has(b.id)) - Number(miennes.has(a.id)));
  const ouverts = matchs.filter((m) => m.statut !== "termine" && m.marche_id).slice(0, 6);

  return (
    <div className="mt-8 flex flex-col gap-7">
      <section aria-labelledby="salons-communautes">
        <h2 id="salons-communautes" className="text-xl">
          Salons des communautés
        </h2>
        {liste.length === 0 ? (
          <p className="mt-2 text-sm text-texte-secondaire">Les communautés arrivent bientôt.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {liste.map((c) => (
              <li key={c.id}>
                <Link href={`/communautes/${c.id}#chat`} className={LIGNE}>
                  <span className="font-bold">{c.nom}</span>
                  {miennes.has(c.id) && <span className="rounded-full bg-oui-fond px-2.5 py-1 text-xs font-bold text-oui-texte">Membre</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ouverts.length > 0 && (
        <section aria-labelledby="salons-matchs">
          <h2 id="salons-matchs" className="text-xl">
            Chats des matchs à venir
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {ouverts.map((m) => (
              <li key={m.id}>
                <Link href={`/marches/${m.marche_id}#chat`} className={LIGNE}>
                  <span className="font-bold">
                    {m.dom} – {m.ext}
                  </span>
                  <span className="flex-none text-xs text-texte-secondaire">{m.ligue.nom}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(discutes ?? []).length > 0 && (
        <section aria-labelledby="salons-discutes">
          <h2 id="salons-discutes" className="text-xl">
            Ça discute ici
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {discutes!.map((d) => (
              <li key={d.marche_id}>
                <Link href={`/marches/${d.marche_id}#chat`} className={LIGNE}>
                  <span className="font-semibold">{d.marche?.question}</span>
                  <span className="flex-none text-xs text-texte-secondaire">{formaterNombre(d.commentaires_24h)} en 24 h</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
