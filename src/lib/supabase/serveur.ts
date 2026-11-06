import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configSupabaseObligatoire } from "./config";

// Client Supabase pour les composants serveur, Server Actions et routes API.
// Agit au nom de l'utilisateur connecté (cookies de session) : la RLS s'applique.
// Créer un nouveau client à chaque requête.
export async function creerClientServeur() {
  const { url, cleAnon } = configSupabaseObligatoire();
  const magasinCookies = await cookies();

  return createServerClient(url, cleAnon, {
    cookies: {
      getAll() {
        return magasinCookies.getAll();
      },
      setAll(cookiesAEcrire) {
        try {
          cookiesAEcrire.forEach(({ name, value, options }) => magasinCookies.set(name, value, options));
        } catch {
          // Appelé depuis un composant serveur : impossible d'écrire les cookies ici.
          // Le proxy (src/proxy.ts) rafraîchit la session à chaque requête.
        }
      },
    },
  });
}
