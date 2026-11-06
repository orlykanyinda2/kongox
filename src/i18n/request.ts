import { getRequestConfig } from "next-intl/server";

// Langues de l'interface. Le français est la langue par défaut (et la seule pour l'instant).
export const langues = ["fr"] as const;
export const langueParDefaut = "fr";

export default getRequestConfig(async () => {
  const locale = langueParDefaut;

  return {
    locale,
    timeZone: "Africa/Kinshasa",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
