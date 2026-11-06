import { createBrowserClient } from "@supabase/ssr";
import { configSupabaseObligatoire } from "./config";

// Client Supabase pour les composants navigateur ("use client").
// Utilise uniquement la clé publique : la Row Level Security protège les données.
export function creerClientNavigateur() {
  const { url, cleAnon } = configSupabaseObligatoire();
  return createBrowserClient(url, cleAnon);
}
