import type { NextRequest } from "next/server";
import { mettreAJourSession } from "@/lib/supabase/proxy";

// Proxy Next.js (ancien « middleware ») : garde la session Supabase à jour.
export async function proxy(requete: NextRequest) {
  return mettreAJourSession(requete);
}

export const config = {
  // Pas sur les fichiers statiques, les images, le manifeste ni le service worker
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|icones/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
