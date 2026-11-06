import { getTranslations } from "next-intl/server";
import { exigerAdmin } from "@/lib/admin/acces";

// Écran admin qui arrive à une étape suivante
export async function EcranBientot({ titre, etape }: { titre: string; etape: number }) {
  await exigerAdmin();
  const t = await getTranslations("admin");
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-[32px] tracking-[-1px] md:text-4xl">{titre}</h1>
      <p className="rounded-carte border-2 border-dashed border-sauge bg-doux p-6 text-[15px]">{t("bientotEtape", { etape })}</p>
    </main>
  );
}
