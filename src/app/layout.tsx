import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { NextIntlClientProvider, useMessages } from "next-intl";
import { getTranslations } from "next-intl/server";
import { EnregistrementServiceWorker } from "@/components/EnregistrementServiceWorker";
import { SuiviFil } from "@/components/marches/SuiviFil";
import { scriptTheme } from "@/lib/theme";
import { OPEN_GRAPH, urlSite } from "@/lib/partage";
import "./globals.css";

const inter = Inter({
  variable: "--police-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--police-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(urlSite()),
    title: t("titre"),
    description: t("description"),
    applicationName: "KongoX",
    // Aperçu des liens (WhatsApp, Facebook, Telegram) : la carte image vient de opengraph-image.tsx
    openGraph: { ...OPEN_GRAPH, title: t("titre"), description: t("description") },
    twitter: { card: "summary_large_image" },
    icons: { apple: "/icones/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: "KongoX", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#13241A" },
  ],
};

// Textes envoyés au navigateur : seulement ceux des composants "use client" (pages plus légères).
// Ajouter ici le nom d'une section de messages/fr.json si un nouveau composant client l'utilise.
const TEXTES_NAVIGATEUR = ["assistant", "accueil", "bonus", "chat", "compte", "curateur", "marche", "navigation", "prediction", "profil", "proposer", "theme"] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  const tous = useMessages();
  const textesNavigateur = Object.fromEntries(TEXTES_NAVIGATEUR.map((cle) => [cle, tous[cle]]));
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applique le thème avant l'affichage pour éviter un flash blanc */}
        <script dangerouslySetInnerHTML={{ __html: scriptTheme }} />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={textesNavigateur}>{children}</NextIntlClientProvider>
        <EnregistrementServiceWorker />
        <SuiviFil />
      </body>
    </html>
  );
}
