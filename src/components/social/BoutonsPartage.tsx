"use client";

import { useState, useSyncExternalStore } from "react";
import { liensPartage } from "@/lib/partage";
import {
  IconeFacebook,
  IconeImage,
  IconeLien,
  IconePartage,
  IconeTelegram,
  IconeTikTok,
  IconeWhatsApp,
} from "@/components/icones";

type Props = {
  url: string; // adresse complète de la page à partager
  texte: string; // phrase d'accroche (sans le lien)
  carte?: string; // adresse de la carte image (téléchargeable, pour TikTok ou un statut WhatsApp)
  titre?: string;
};

const BOUTON =
  "flex h-11 items-center justify-center gap-2 rounded-champ border-2 border-contour bg-surface px-3 text-sm font-bold text-texte";

// Boutons de partage : WhatsApp en premier (le plus utilisé), puis Facebook, Telegram, TikTok, copier le lien.
// Sur téléphone, « Partager… » ouvre le menu de partage du système quand il existe.
export function BoutonsPartage({
  url,
  texte,
  carte,
  titre = "Partager",
}: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const liens = liensPartage(url, texte);

  const copier = async (pourTikTok = false) => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage(
        pourTikTok
          ? "Lien copié : colle-le dans ta vidéo ou ta bio TikTok."
          : "Lien copié.",
      );
    } catch {
      setMessage(`Copie impossible : ${url}`);
    }
  };

  const partagerSysteme = async () => {
    try {
      await navigator.share({ title: "KongoX", text: texte, url });
    } catch {
      // Partage annulé : rien à faire
    }
  };

  return (
    <section aria-label={titre} className="flex flex-col gap-2">
      <a
        href={liens.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-[52px] items-center justify-center gap-2 rounded-champ bg-cat-vie-fond text-[15px] font-bold text-hunter"
      >
        <IconeWhatsApp />
        Partager sur WhatsApp
      </a>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <a
          href={liens.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className={BOUTON}
        >
          <IconeFacebook />
          Facebook
        </a>
        <a
          href={liens.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className={BOUTON}
        >
          <IconeTelegram />
          Telegram
        </a>
        <button type="button" onClick={() => copier(true)} className={BOUTON}>
          <IconeTikTok />
          TikTok
        </button>
        <button type="button" onClick={() => copier()} className={BOUTON}>
          <IconeLien />
          Copier le lien
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {carte && (
          <a
            href={carte}
            download="kongox.png"
            className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-texte-secondaire underline"
          >
            <IconeImage taille={16} />
            Télécharger la carte
          </a>
        )}
        <PartageSysteme onPartager={partagerSysteme} />
      </div>
      {message && (
        <p
          role="status"
          className="break-all text-center text-sm font-semibold text-texte-secondaire"
        >
          {message}
        </p>
      )}
    </section>
  );
}

// Bouton « Partager… » seulement si le navigateur sait le faire (Android, iPhone)
function PartageSysteme({ onPartager }: { onPartager: () => void }) {
  // Faux au rendu serveur, vrai ensuite si le navigateur sait partager (pas d'écart d'hydratation)
  const possible = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );
  if (!possible) return null;
  return (
    <button
      type="button"
      onClick={onPartager}
      className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-texte-secondaire underline"
    >
      <IconePartage taille={16} />
      Partager…
    </button>
  );
}
