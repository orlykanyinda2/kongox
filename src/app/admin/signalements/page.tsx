import { Suspense } from "react";
import { EnTetePage, Section } from "@/components/admin/ui";
import { exigerAdmin } from "@/lib/admin/acces";

// Les signalements (messages et marchés) arrivent avec le chat, à l'étape 5.
export default function PageSignalements() {
  return (
    <Suspense fallback={null}>
      <Signalements />
    </Suspense>
  );
}

async function Signalements() {
  await exigerAdmin();
  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre="Signalements" />
      <Section>
        <p className="text-sm text-adm-secondaire">Cet écran arrive à l&apos;étape 5, avec le chat (signalement des messages et modération).</p>
      </Section>
    </div>
  );
}
