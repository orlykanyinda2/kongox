import { votesMarche } from "@/lib/votes/donnees";
import { utilisateurConnecte } from "@/lib/compte/session";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { QuiAVote } from "./QuiAVote";

// Prépare « Qui a voté » : premiers votes, et nombre de personnes que je suis qui ont voté. Dans un <Suspense>.
export async function QuiAVoteServeur({ marche, options }: { marche: number; options: { ordre: number; libelle: string }[] }) {
  const [{ votes, total }, u] = await Promise.all([votesMarche(marche, null, "recents", 0), utilisateurConnecte()]);
  let suivis = 0;
  if (u && !u.invite) {
    const { data } = await (await creerClientServeur()).rpc("suivis_ayant_vote", { p_marches: [marche] });
    suivis = Number((data as { nombre: number }[] | null)?.[0]?.nombre ?? 0);
  }
  return <QuiAVote marche={marche} options={options} initiaux={votes} total={total} suivis={suivis} />;
}
