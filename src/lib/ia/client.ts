import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Client de l'API Claude : côté serveur uniquement (la clé ANTHROPIC_API_KEY ne part jamais au navigateur).
// Délai court et une seule nouvelle tentative : si l'API est lente, on affiche un message plutôt que d'attendre.
let client: Anthropic | null = null;

export function clientClaude(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 1 });
  return client;
}
