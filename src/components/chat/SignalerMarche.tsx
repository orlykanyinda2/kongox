"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const MOTIFS = ["ligne_rouge", "arnaque", "spam", "insulte", "autre"] as const;

// Bouton discret « Signaler ce marché » : le motif est choisi, puis l'équipe le voit dans Admin › Signalements.
export function SignalerMarche({ marche }: { marche: number }) {
  const t = useTranslations("chat");
  const [ouvert, setOuvert] = useState(false);
  const [retour, setRetour] = useState<string | null>(null);

  const envoyer = async (motif: string) => {
    setOuvert(false);
    const { creerClientNavigateur } = await import("@/lib/supabase/client");
    const { data, error } = await creerClientNavigateur().rpc("signaler", { p_message: null, p_marche: marche, p_motif: motif });
    if (error) setRetour(t(`erreurs.${error.hint === "signalement_limite" ? "signalement_limite" : "serveur"}`, { max: 0 }));
    else setRetour(data === "deja" ? t("marcheDejaSignale") : t("marcheSignale"));
  };

  if (retour)
    return (
      <p role="status" className="text-center text-xs font-semibold text-texte-secondaire">
        {retour}
      </p>
    );
  if (!ouvert)
    return (
      <button type="button" onClick={() => setOuvert(true)} className="min-h-11 self-center text-xs font-semibold text-texte-secondaire underline">
        {t("signalerMarche")}
      </button>
    );
  return (
    <div role="group" aria-label={t("signalerMarcheTitre")} className="flex flex-wrap items-center justify-center gap-1.5">
      <span className="w-full text-center text-xs font-semibold">{t("signalerMarcheTitre")}</span>
      {MOTIFS.map((m) => (
        <button key={m} type="button" onClick={() => envoyer(m)} className="min-h-9 rounded-full border border-separateur px-2.5 text-xs font-semibold">
          {t(`motif_${m}`)}
        </button>
      ))}
      <button type="button" onClick={() => setOuvert(false)} className="min-h-9 px-2 text-xs underline">
        {t("annuler")}
      </button>
    </div>
  );
}
