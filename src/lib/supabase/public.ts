import { PostgrestClient } from "@supabase/postgrest-js";
import { configSupabaseObligatoire } from "./config";

// Client de base de données SANS session (visiteur anonyme), pour les données publiques mises en cache :
// marchés publiés, cagnottes, historique. On utilise seulement PostgREST (pas le module Auth de
// supabase-js), ce qui le rend léger et utilisable dans "use cache" pendant le pré-rendu.
export function creerClientPublic() {
  const { url, cleAnon } = configSupabaseObligatoire();
  return new PostgrestClient(`${url}/rest/v1`, {
    headers: { apikey: cleAnon, Authorization: `Bearer ${cleAnon}` },
    timeout: 15_000,
  });
}
