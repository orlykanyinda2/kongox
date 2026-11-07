import { getRequestConfig } from "next-intl/server";
import { appliquerReglages, lireReglages } from "@/lib/reglages";

// Langues de l'interface. Le français est la langue par défaut (et la seule pour l'instant).
export const langues = ["fr"] as const;
export const langueParDefaut = "fr";

export default getRequestConfig(async () => {
  const locale = langueParDefaut;
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    timeZone: "Africa/Kinshasa",
    // Les montants des textes ([[bonus_inscription]]…) suivent les réglages du panneau admin
    messages: appliquerReglages(messages, await lireReglages()),
  };
});
