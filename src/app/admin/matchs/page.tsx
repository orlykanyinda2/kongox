import { Suspense } from "react";
import { EcranBientot } from "@/components/admin/Bientot";

// Arrive à l'étape 4
export default function Page() {
  return (
    <Suspense fallback={null}>
      <EcranBientot titre="Matchs" etape={4} />
    </Suspense>
  );
}
