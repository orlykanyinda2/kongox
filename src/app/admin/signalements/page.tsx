import { Suspense } from "react";
import { EcranBientot } from "@/components/admin/Bientot";

// Arrive à l'étape 5
export default function Page() {
  return (
    <Suspense fallback={null}>
      <EcranBientot titre="Signalements" etape={5} />
    </Suspense>
  );
}
