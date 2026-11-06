import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configSupabaseObligatoire } from "./config";

// Client Supabase ADMIN, avec la clé service role : il contourne la Row Level Security.
// Uniquement côté serveur (ex. réinitialisation d'un mot de passe par un admin).
// Ne jamais l'importer dans un composant "use client" : "server-only" bloque la compilation si c'est le cas.
export function creerClientAdmin() {
  const { url } = configSupabaseObligatoire();
  const cleServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cleServiceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manque dans .env.local.");
  }
  return createClient(url, cleServiceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
