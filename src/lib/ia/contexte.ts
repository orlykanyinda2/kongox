import "server-only";
import { creerClientPublic } from "@/lib/supabase/public";
import { listerMarchesOuverts, obtenirMarche } from "@/lib/marches/donnees";
import { matchDuMarche, matchsAVenir } from "@/lib/football/donnees";
import { LIBELLES_CATEGORIES } from "@/lib/marches/categories";

// Partie VARIABLE du prompt : les données du moment, tirées de la base.
// Envoyée après la partie fixe (mise en cache), dans un bloc <contexte>.

const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kinshasa" });

type Forme = { date_match: string; adversaire: string; domicile: boolean; buts_pour: number; buts_contre: number; resultat: string };

async function formeEquipe(nom: string): Promise<string> {
  const db = creerClientPublic();
  const { data: equipe } = await db.from("equipes").select("id").eq("nom", nom).limit(1).maybeSingle();
  if (!equipe) return `${nom} : aucun match terminé connu.`;
  const { data } = await db.rpc("forme_equipe", { p_equipe: equipe.id, p_limite: 5 });
  const matchs = (data ?? []) as Forme[];
  if (matchs.length === 0) return `${nom} : aucun match terminé connu.`;
  const lignes = matchs.map(
    (m) => `${m.resultat === "V" ? "victoire" : m.resultat === "N" ? "nul" : "défaite"} ${m.buts_pour}-${m.buts_contre} ${m.domicile ? "contre" : "chez"} ${m.adversaire}`,
  );
  return `${nom}, ${matchs.length} derniers matchs connus (du plus récent au plus ancien) : ${lignes.join(" ; ")}.`;
}

export async function construireContexte(marcheId: number | null): Promise<string> {
  const lignes: string[] = [`Date et heure à Kinshasa : ${date.format(new Date())}.`];

  if (marcheId) {
    const [marche, match] = await Promise.all([obtenirMarche(marcheId), matchDuMarche(marcheId)]);
    if (match) {
      lignes.push(
        `La personne regarde le match ${match.dom} – ${match.ext} (${match.ligue.nom}${match.journee ? `, ${match.journee}` : ""}), coup d'envoi ${date.format(new Date(match.date_match))} (heure de Kinshasa).`,
        `Statut du match : ${match.statut === "termine" ? `terminé, score ${match.buts_dom}-${match.buts_ext}` : match.statut === "en_cours" ? "en cours" : match.statut === "annule" ? "annulé" : match.statut === "reporte" ? "reporté" : "à venir"}.`,
        `Avis de la communauté KongoX (part des pièces misées) : 1 (${match.dom}) ${match.pourcentages[0]} %, N (nul) ${match.pourcentages[1]} %, 2 (${match.ext}) ${match.pourcentages[2]} %. Pièces misées : ${match.volume}.`,
        `Les mises ${match.ouvert ? "sont ouvertes" : "sont fermées"}.`,
        `Forme récente : ${await formeEquipe(match.dom)} ${await formeEquipe(match.ext)}`,
      );
    } else if (marche) {
      lignes.push(
        `La personne regarde le marché : « ${marche.question} » (catégorie ${LIBELLES_CATEGORIES[marche.categorie]}).`,
        `Source de la réponse : ${marche.source}. Fin des mises : ${date.format(new Date(marche.date_fin))} (heure de Kinshasa).`,
        `Avis de la communauté KongoX (part des pièces misées) : OUI ${marche.pourcentageOui} %, NON ${100 - marche.pourcentageOui} %. Pièces misées : ${marche.volume}.`,
        marche.statut === "regle"
          ? `Ce marché est réglé${marche.option_gagnante_id ? ` : la bonne réponse était ${marche.options.find((o) => o.id === marche.option_gagnante_id)?.libelle}` : " (annulé, mises remboursées)"}.`
          : `Les mises ${marche.ouvert ? "sont ouvertes" : "sont fermées, le résultat n'est pas encore publié"}.`,
      );
    } else {
      lignes.push("Aucun marché précis : la personne pose une question générale.");
    }
  } else {
    // Onglet Chat : vue d'ensemble
    const [marches, matchs] = await Promise.all([listerMarchesOuverts(), matchsAVenir(8)]);
    if (marches.length) {
      lignes.push(
        "Marchés en ligne les plus misés sur KongoX (avis de la communauté) :",
        ...marches.slice(0, 6).map((m) => `- « ${m.question} » : OUI ${m.pourcentageOui} %, NON ${100 - m.pourcentageOui} % (${m.volume} pièces).`),
      );
    }
    const ouverts = matchs.filter((m) => m.statut === "a_venir" && m.ouvert).slice(0, 6);
    if (ouverts.length) {
      lignes.push(
        "Prochains matchs ouverts aux prédictions (heure de Kinshasa) :",
        ...ouverts.map((m) => `- ${m.dom} – ${m.ext} (${m.ligue.nom}), ${date.format(new Date(m.date_match))} : 1 ${m.pourcentages[0]} %, N ${m.pourcentages[1]} %, 2 ${m.pourcentages[2]} %.`),
      );
    }
  }
  return `<contexte>\n${lignes.join("\n")}\n</contexte>`;
}
