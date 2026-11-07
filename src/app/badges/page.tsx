import { Suspense } from "react";
import Link from "next/link";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { BadgeIcone, COULEURS_NIVEAU, type Niveau } from "@/components/badges/BadgeIcone";
import { ChoixVedette } from "@/components/badges/ChoixVedette";
import { utilisateurConnecte } from "@/lib/compte/session";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { creerClientPublic } from "@/lib/supabase/public";

export const metadata = { title: "Badges — KongoX" };

type Ligne = {
  code: string;
  nom: string;
  description: string;
  glyphe: string;
  niveau: Niveau;
  famille: string;
  condition: string;
  seuil: number;
  valeur: number | null;
  gagne_le: string | null;
};

const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Kinshasa" });
const UNITES: Record<string, string> = {
  predictions: "prédictions",
  serie: "jours de suite",
  mayele: "% de score Mayele",
  questions_approuvees: "questions approuvées",
  parrain: "amis invités",
  bavard: "commentaires",
};

// Tous les badges : ceux gagnés et ceux à gagner, avec la progression
export default function PageBadges() {
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <main className="mx-auto w-full max-w-contenu flex-1 px-[18px] pb-28 pt-6 md:px-6 md:pb-12">
        <h1 className="text-[32px] tracking-[-1px] md:text-[40px]">Badges</h1>
        <p className="mt-1.5 text-[15px] text-texte-secondaire">
          Ils se gagnent tout seuls en jouant : séries, prédictions, score Mayele, questions approuvées… Certains débloquent des icônes élite.
        </p>
        <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-carte bg-doux" />}>
          <Contenu />
        </Suspense>
      </main>
      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}

function progression(b: Ligne) {
  if (b.gagne_le) return `Gagné le ${date.format(new Date(b.gagne_le))}`;
  if (b.condition === "top10_semaine" || b.condition === "top10_mois" || b.condition === "fidele" || b.condition === "curateur" || b.condition === "manuel") return "À gagner";
  if (b.valeur === null) return `Objectif : ${b.seuil} ${UNITES[b.condition] ?? ""}`;
  if (b.condition === "mayele") return b.valeur > 0 ? `Ton score : ${b.valeur} % (objectif ${b.seuil} %)` : "Il faut 20 prédictions réglées";
  return `${Math.min(b.valeur, b.seuil)}/${b.seuil} ${UNITES[b.condition] ?? ""}`;
}

async function Contenu() {
  const u = await utilisateurConnecte();
  // Connecté : la progression est calculée pour moi ; visiteur : la liste seule
  const serveur = u ? await creerClientServeur() : null;
  const [{ data }, vedette] = await Promise.all([
    serveur ? serveur.rpc("progression_badges") : creerClientPublic().rpc("progression_badges"),
    serveur && u ? serveur.from("utilisateurs").select("badges_vedette").eq("id", u.id).maybeSingle<{ badges_vedette: string[] }>() : Promise.resolve({ data: null }),
  ]);
  const badges = (data ?? []) as Ligne[];
  const familles = [...new Set(badges.map((b) => b.famille))];
  const gagnes = badges.filter((b) => b.gagne_le);

  return (
    <div className="mt-6 flex flex-col gap-8">
      {u ? (
        <p className="rounded-champ bg-doux px-4 py-3 text-[15px] font-semibold">
          Tu as {gagnes.length} badge{gagnes.length > 1 ? "s" : ""} sur {badges.length}.
        </p>
      ) : (
        <p className="rounded-champ bg-doux px-4 py-3 text-[15px]">
          <Link href="/inscription" className="font-bold underline">
            Crée ton compte
          </Link>{" "}
          pour gagner des badges et suivre ta progression.
        </p>
      )}

      {u && gagnes.length > 0 && (
        <ChoixVedette badges={gagnes.map((b) => ({ code: b.code, nom: b.nom, glyphe: b.glyphe, niveau: b.niveau }))} choisis={vedette.data?.badges_vedette ?? []} />
      )}

      {familles.map((f) => (
        <section key={f} aria-labelledby={`famille-${f}`}>
          <h2 id={`famille-${f}`} className="text-xl">
            {f}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {badges
              .filter((b) => b.famille === f)
              .map((b) => {
                const pourcent = b.gagne_le ? 100 : b.valeur !== null && b.seuil > 0 ? Math.min(100, Math.round((100 * b.valeur) / b.seuil)) : 0;
                return (
                  <li key={b.code} className={`flex items-center gap-3.5 rounded-[18px] border-2 p-4 ${b.gagne_le ? "border-foret bg-surface shadow-decale" : "border-separateur bg-doux"}`}>
                    <BadgeIcone glyphe={b.glyphe} niveau={b.niveau} taille={56} gris={!b.gagne_le} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {b.nom} <span className="text-xs font-semibold text-texte-secondaire">· {COULEURS_NIVEAU[b.niveau]?.libelle}</span>
                      </p>
                      <p className="text-[13px] leading-snug text-texte-secondaire">{b.description}</p>
                      <p className="mt-1 text-xs font-semibold">{progression(b)}</p>
                      {!b.gagne_le && u && pourcent > 0 && (
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-separateur" aria-hidden="true">
                          <div className="h-full rounded-full bg-sauge" style={{ width: `${pourcent}%` }} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
