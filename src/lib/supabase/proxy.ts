import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configSupabase } from "./config";

// Rafraîchit la session Supabase à chaque requête et réécrit les cookies si besoin.
export async function mettreAJourSession(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete });

  const { url, cleAnon, prete } = configSupabase();
  // Supabase pas encore configuré (.env.local vide) : on laisse passer.
  if (!prete || !url || !cleAnon) return reponse;

  const supabase = createServerClient(url, cleAnon, {
    cookies: {
      getAll() {
        return requete.cookies.getAll();
      },
      setAll(cookiesAEcrire, entetes) {
        cookiesAEcrire.forEach(({ name, value }) => requete.cookies.set(name, value));
        reponse = NextResponse.next({ request: requete });
        cookiesAEcrire.forEach(({ name, value, options }) => reponse.cookies.set(name, value, options));
        // En-têtes anti-cache : une session ne doit jamais être servie à un autre utilisateur
        Object.entries(entetes).forEach(([cle, valeur]) => reponse.headers.set(cle, valeur));
      },
    },
  });

  // Ne rien mettre entre la création du client et cet appel : il valide et rafraîchit le jeton.
  await supabase.auth.getClaims();

  return reponse;
}
