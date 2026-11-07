import { type NextRequest } from "next/server";
import { importerFootball } from "@/lib/football/import";

// Import planifié (Vercel Cron en production) : protégé par CRON_SECRET.
// Vercel envoie « Authorization: Bearer <CRON_SECRET> ».
export async function GET(requete: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || requete.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Accès refusé.", { status: 401 });
  }
  const bilans = await importerFootball({ declenchePar: "cron" });
  return Response.json({ bilans });
}
