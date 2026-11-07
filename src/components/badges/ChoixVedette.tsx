"use client";

import { useState, useTransition } from "react";
import { choisirBadgesVedette } from "@/app/actions/badges";
import { BadgeIcone, type Niveau } from "./BadgeIcone";

// Choisir les 4 badges mis en avant sur son profil public
export function ChoixVedette({ badges, choisis: depart }: { badges: { code: string; nom: string; glyphe: string; niveau: Niveau }[]; choisis: string[] }) {
  const [choisis, setChoisis] = useState<string[]>(depart);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const basculer = (code: string) => {
    setMessage(null);
    setChoisis((c) => (c.includes(code) ? c.filter((x) => x !== code) : c.length >= 4 ? c : [...c, code]));
  };

  return (
    <section aria-labelledby="titre-vedette" className="rounded-carte border-2 border-contour bg-surface p-5 shadow-decale-md">
      <h2 id="titre-vedette" className="text-xl">
        Mes 4 badges sur mon profil
      </h2>
      <p className="mt-1 text-sm text-texte-secondaire">Touche jusqu&apos;à 4 badges : ils s&apos;affichent en premier sur ton profil public.</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {badges.map((b) => {
          const actif = choisis.includes(b.code);
          return (
            <li key={b.code}>
              <button
                type="button"
                aria-pressed={actif}
                onClick={() => basculer(b.code)}
                disabled={!actif && choisis.length >= 4}
                className={`flex min-h-11 items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3 text-sm font-bold disabled:opacity-40 ${actif ? "border-foret bg-vert-jaune text-foret" : "border-separateur bg-surface"}`}
              >
                <BadgeIcone glyphe={b.glyphe} niveau={b.niveau} taille={28} />
                {b.nom}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={enCours}
          onClick={() => demarrer(async () => {
            const r = await choisirBadgesVedette(choisis);
            setMessage(r.erreur ?? r.succes ?? null);
          })}
          className="h-11 rounded-bouton bg-foret px-4 text-sm font-bold text-white disabled:opacity-60 dark:bg-vert-jaune dark:text-foret"
        >
          {enCours ? "…" : "Enregistrer"}
        </button>
        <span className="text-sm text-texte-secondaire">{choisis.length}/4</span>
        {message && (
          <span role="status" className="text-sm font-semibold">
            {message}
          </span>
        )}
      </div>
    </section>
  );
}
