import { type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { clientClaude } from "@/lib/ia/client";
import { construireContexte } from "@/lib/ia/contexte";
import { PROMPT_SYSTEME_FIXE, type MessageChat } from "@/lib/ia/prompt";
import { lireReglages } from "@/lib/reglages";
import { SIGNAL_ERREUR } from "@/lib/ia/constantes";

// Assistant KongoX : réponse en streaming (texte brut, morceau par morceau).
// Une erreur pendant la réponse est envoyée après le caractère SIGNAL_ERREUR, que le navigateur affiche à part.

const MAX_MESSAGES = 12; // 6 échanges
const MAX_CARACTERES = 500;

const MESSAGES = {
  connexion: "Connecte-toi pour poser une question à l'assistant.",
  limite: (n: number) => `Tu as posé tes ${n} questions du jour. Reviens demain, l'assistant t'attend !`,
  plafond: "L'assistant a beaucoup parlé aujourd'hui : il se repose jusqu'à demain. Merci de ta patience !",
  desactive: "L'assistant est en pause pour le moment. Réessaie plus tard.",
  panne: "L'assistant ne répond pas pour l'instant. Réessaie dans un moment : ta question ne t'a pas été comptée.",
  refus: "Je ne peux pas répondre à cette question. Pose-moi plutôt une question sur un marché ou un match !",
  invalide: "Message invalide.",
};

function erreurJson(message: string, statut: number) {
  return Response.json({ erreur: message }, { status: statut, headers: { "Cache-Control": "no-store" } });
}

// Valide l'historique envoyé par le navigateur (rôles alternés, textes courts, dernier message de l'utilisateur)
function lireMessages(brut: unknown): MessageChat[] | null {
  if (!Array.isArray(brut) || brut.length === 0) return null;
  const messages = brut.slice(-MAX_MESSAGES).map((m) => ({
    role: m?.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: String(m?.content ?? "").trim().slice(0, MAX_CARACTERES),
  }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (messages.length === 0 || messages[messages.length - 1].role !== "user" || !messages[messages.length - 1].content) return null;
  return messages.filter((m) => m.content);
}

export async function POST(requete: NextRequest) {
  const supabase = await creerClientServeur();
  const { data: session } = await supabase.auth.getClaims();
  if (!session?.claims?.sub) return erreurJson(MESSAGES.connexion, 401);

  const corps = await requete.json().catch(() => null);
  const messages = lireMessages(corps?.messages);
  if (!messages) return erreurJson(MESSAGES.invalide, 400);
  const numero = Number(corps?.marche);
  const marche = Number.isInteger(numero) && numero > 0 ? numero : null;

  const claude = clientClaude();
  if (!claude) return erreurJson(MESSAGES.desactive, 503);

  // Compte la question (limite par personne + plafond global) avant d'appeler l'API
  const reglages = await lireReglages();
  const { data: restantes, error } = await supabase.rpc("reserver_question_ia");
  if (error) {
    if (error.hint === "ia_limite_personne") return erreurJson(MESSAGES.limite(Number(reglages.ia_questions_par_jour)), 429);
    if (error.hint === "ia_plafond_global") return erreurJson(MESSAGES.plafond, 429);
    if (error.hint === "ia_desactivee") return erreurJson(MESSAGES.desactive, 503);
    console.error("[assistant] réservation :", error.message);
    return erreurJson(MESSAGES.panne, 503);
  }

  const contexte = await construireContexte(marche).catch((e) => {
    console.error("[assistant] contexte :", e instanceof Error ? e.message : e);
    return "<contexte>\nAucune donnée disponible pour le moment.\n</contexte>";
  });
  const modele = String(reglages.ia_modele || "claude-haiku-5-5");
  const encodeur = new TextEncoder();

  const corpsReponse = new ReadableStream<Uint8Array>({
    async start(controleur) {
      let ecrit = false;
      try {
        const flux = claude.messages.stream({
          model: modele,
          max_tokens: 1024,
          output_config: { effort: "low" }, // chat court et rapide
          system: [
            // Partie fixe : mise en cache (identique à chaque requête)
            { type: "text", text: PROMPT_SYSTEME_FIXE, cache_control: { type: "ephemeral" } },
            // Partie variable : données du moment (après le point de cache)
            { type: "text", text: contexte },
          ],
          messages,
        });
        for await (const evenement of flux) {
          if (evenement.type === "content_block_delta" && evenement.delta.type === "text_delta") {
            controleur.enqueue(encodeur.encode(evenement.delta.text));
            ecrit = true;
          }
        }
        const final = await flux.finalMessage();
        if (final.stop_reason === "refusal") {
          controleur.enqueue(encodeur.encode((ecrit ? "\n\n" : "") + MESSAGES.refus));
        }
        const u = final.usage;
        await creerClientAdmin().rpc("enregistrer_usage_ia", {
          p_entree: u.input_tokens,
          p_sortie: u.output_tokens,
          p_cache_lus: u.cache_read_input_tokens ?? 0,
          p_cache_ecrits: u.cache_creation_input_tokens ?? 0,
        });
      } catch (e) {
        // API injoignable, délai dépassé, modèle inconnu… : la question est rendue
        if (e instanceof Anthropic.APIError) console.error("[assistant] API Claude :", e.status, e.message);
        else console.error("[assistant] erreur :", e instanceof Error ? e.message : e);
        await supabase.rpc("rendre_question_ia");
        controleur.enqueue(encodeur.encode(SIGNAL_ERREUR + MESSAGES.panne));
      } finally {
        controleur.close();
      }
    },
  });

  return new Response(corpsReponse, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Questions-Restantes": String(restantes ?? 0),
    },
  });
}
