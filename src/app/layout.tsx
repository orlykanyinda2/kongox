import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { EnregistrementServiceWorker } from "@/components/EnregistrementServiceWorker";
import { scriptTheme } from "@/lib/theme";
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
    title: t("titre"),
    description: t("description"),
    applicationName: "KongoX",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
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
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <EnregistrementServiceWorker />
      </body>
    </html>
  );
}
