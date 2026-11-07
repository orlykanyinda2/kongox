"use client";

import { useState } from "react";

// « Signaler cette photo » : nudité, violence, insulte… Retirée automatiquement après plusieurs signalements.
export function SignalerPhoto({ utilisateur }: { utilisateur: string }) {
  const [retour, setRetour] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);

  const envoyer = async () => {
    setOuvert(false);
    const { creerClientNavigateur } = await import("@/lib/supabase/client");
    const { data, error } = await creerClientNavigateur().rpc("signaler", { p_message: null, p_marche: null, p_motif: "photo", p_utilisateur: utilisateur });
    if (error) setRetour(error.hint === "signalement_limite" ? "Tu as fait beaucoup de signalements aujourd'hui." : "Un problème est survenu. Réessaie.");
    else setRetour(data === "deja" ? "Tu as déjà signalé cette photo." : "Merci, l'équipe va regarder cette photo.");
  };

  if (retour) return <p role="status" className="text-xs font-semibold text-texte-secondaire">{retour}</p>;
  if (!ouvert)
    return (
      <button type="button" onClick={() => setOuvert(true)} className="min-h-9 self-start text-xs font-semibold text-texte-secondaire underline">
        Signaler cette photo
      </button>
    );
  return (
    <div role="group" aria-label="Signaler cette photo" className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold">Cette photo montre de la nudité, de la violence ou une insulte ?</span>
      <button type="button" onClick={envoyer} className="min-h-9 rounded-full border border-separateur px-3 font-semibold">
        Oui, signaler
      </button>
      <button type="button" onClick={() => setOuvert(false)} className="min-h-9 px-2 underline">
        Annuler
      </button>
    </div>
  );
}
