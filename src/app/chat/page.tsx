import { Suspense } from "react";
import { EnTete } from "@/components/mise-en-page/EnTete";
import { PiedDePage } from "@/components/mise-en-page/PiedDePage";
import { BarreNavigation } from "@/components/mise-en-page/BarreNavigation";
import { AssistantServeur } from "@/components/ia/AssistantServeur";

export const metadata = { title: "Chat — KongoX" };

// Onglet « Chat » de la barre du bas : l'assistant KongoX (les salons de chat arrivent ensuite).
export default function PageChat() {
  return (
    <div className="flex flex-1 flex-col">
      <EnTete />
      <main className="mx-auto w-full max-w-[640px] flex-1 px-[18px] pb-28 pt-6 md:pb-12">
        <h1 className="text-[28px] tracking-[-0.5px] md:text-[34px]">Chat</h1>
        <p className="mb-5 mt-1.5 text-[15px] text-texte-secondaire">
          Pose tes questions à l&apos;assistant KongoX en lingala, swahili, français ou anglais : marchés, matchs, comment jouer. Les salons de discussion arrivent bientôt.
        </p>
        <Suspense fallback={<div className="h-80 animate-pulse rounded-[18px] bg-doux" />}>
          <AssistantServeur grand />
        </Suspense>
      </main>
      <PiedDePage />
      <BarreNavigation />
    </div>
  );
}
