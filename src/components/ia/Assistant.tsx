"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SIGNAL_ERREUR } from "@/lib/ia/constantes";
import { EXEMPLE_VISITEUR } from "@/lib/ia/exemples";

type Bulle = { role: "user" | "assistant"; content: string; erreur?: boolean };

type Props = {
  marche?: number; // marché ou match regardé (contexte de l'assistant)
  connecte: boolean;
  restantes: number; // questions restantes aujourd'hui
  grand?: boolean; // page /chat
};

// Assistant KongoX (maquette Marche, « Demande à l'assistant ») : bulles, réponse qui s'écrit au fur et à mesure.
// L'historique reste dans le navigateur (rien n'est enregistré dans la base).
export function Assistant({ marche, connecte, restantes: initiales, grand = false }: Props) {
  const t = useTranslations("assistant");
  const [bulles, setBulles] = useState<Bulle[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [restantes, setRestantes] = useState(initiales);
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fin.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [bulles]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const question = saisie.trim();
    if (!question || enCours) return;
    const historique: Bulle[] = [...bulles.filter((b) => !b.erreur), { role: "user", content: question }];
    setBulles([...bulles, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setSaisie("");
    setEnCours(true);

    const ecrire = (texte: string, erreur = false) =>
      setBulles((b) => {
        const copie = [...b];
        copie[copie.length - 1] = { role: "assistant", content: texte, erreur };
        return copie;
      });

    try {
      const reponse = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marche: marche ?? null, messages: historique.slice(-12).map(({ role, content }) => ({ role, content })) }),
      });
      if (!reponse.ok || !reponse.body) {
        const corps = await reponse.json().catch(() => null);
        ecrire(corps?.erreur ?? t("panne"), true);
        return;
      }
      const reste = reponse.headers.get("X-Questions-Restantes");
      if (reste !== null) setRestantes(Number(reste));

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let texte = "";
      for (;;) {
        const { value, done } = await lecteur.read();
        if (done) break;
        texte += decodeur.decode(value, { stream: true });
        const i = texte.indexOf(SIGNAL_ERREUR);
        if (i >= 0) {
          const avant = texte.slice(0, i).trim();
          ecrire(avant ? `${avant}\n\n${texte.slice(i + 1)}` : texte.slice(i + 1), true);
          if (reste !== null) setRestantes(Number(reste) + 1); // la question a été rendue
        } else {
          ecrire(texte);
        }
      }
    } catch {
      ecrire(t("panne"), true);
    } finally {
      setEnCours(false);
    }
  }

  const bulleUtilisateur = "max-w-[82%] self-end whitespace-pre-wrap rounded-[14px_14px_4px_14px] bg-doux px-3 py-2.5 text-sm";
  const bulleAssistant = "max-w-[88%] whitespace-pre-wrap rounded-[14px_14px_14px_4px] bg-cat-vie-fond px-3 py-2.5 text-sm leading-[1.45] text-foret";

  return (
    <section aria-label={t("titre")} className="flex flex-col gap-2.5 rounded-[18px] border-2 border-contour bg-surface p-4 shadow-decale">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-foret text-vert-jaune">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </span>
        <span className="flex-1 text-[15px] font-bold">{t("titre")}</span>
        {connecte && <span className="text-xs text-texte-secondaire">{t("restantes", { n: restantes })}</span>}
      </div>

      {!connecte ? (
        // Visiteur : exemple déjà écrit (lingala + français), puis inscription
        <>
          <div className="animate-bulle self-end rounded-[14px_14px_4px_14px] bg-doux px-3 py-2.5 text-sm delai-200">
            <strong>{EXEMPLE_VISITEUR.question}</strong>
            <br />
            <span className="text-xs text-texte-secondaire">{EXEMPLE_VISITEUR.traductionQuestion}</span>
          </div>
          <div className={`${bulleAssistant} animate-bulle delai-1200`}>
            <strong>{EXEMPLE_VISITEUR.reponse}</strong>
            <br />
            <span className="text-xs">{EXEMPLE_VISITEUR.traductionReponse}</span>
          </div>
          <p className="text-xs text-texte-secondaire">{t("exempleNote")}</p>
          <Link href="/inscription" className="flex h-12 items-center justify-center rounded-champ border-2 border-foret bg-foret text-[15px] font-bold text-white shadow-[4px_4px_0_#A7C957] dark:border-vert-jaune">
            {t("creerCompte")}
          </Link>
        </>
      ) : (
        <>
          <div aria-live="polite" className={`flex flex-col gap-2.5 overflow-y-auto ${grand ? "max-h-[55vh] min-h-[200px]" : "max-h-80"}`}>
            {bulles.length === 0 && <p className="text-sm text-texte-secondaire">{t("invite")}</p>}
            {bulles.map((b, i) =>
              b.role === "user" ? (
                <div key={i} className={bulleUtilisateur}>
                  {b.content}
                </div>
              ) : b.content === "" ? (
                <div key={i} className="flex gap-[5px] px-1 py-2" role="status" aria-label={t("ecrit")}>
                  <span className="size-2 animate-point rounded-full bg-sauge" />
                  <span className="size-2 animate-point rounded-full bg-sauge delai-200" />
                  <span className="size-2 animate-point rounded-full bg-sauge delai-400" />
                </div>
              ) : (
                <div key={i} className={b.erreur ? "max-w-[88%] whitespace-pre-wrap rounded-[14px_14px_14px_4px] border-2 border-brique bg-brique/10 px-3 py-2.5 text-sm" : bulleAssistant}>
                  {b.content}
                </div>
              ),
            )}
            <div ref={fin} />
          </div>
          <form onSubmit={envoyer} className="flex gap-2">
            <label htmlFor={`question-ia-${marche ?? "chat"}`} className="sr-only">
              {t("champ")}
            </label>
            <input
              id={`question-ia-${marche ?? "chat"}`}
              value={saisie}
              onChange={(e) => setSaisie(e.target.value.slice(0, 500))}
              placeholder={t("placeholder")}
              disabled={restantes <= 0}
              autoComplete="off"
              className="h-[46px] min-w-0 flex-1 rounded-bouton border border-separateur bg-champagne px-3.5 text-sm text-foret outline-none focus-visible:ring-4 focus-visible:ring-vert-jaune/60 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={enCours || !saisie.trim() || restantes <= 0}
              className="h-[46px] flex-none rounded-bouton border-2 border-foret bg-foret px-4 text-sm font-bold text-white disabled:opacity-50 dark:border-vert-jaune"
            >
              {enCours ? "…" : t("envoyer")}
            </button>
          </form>
          {restantes <= 0 && <p className="text-xs font-semibold text-brique">{t("plusDeQuestions")}</p>}
        </>
      )}
      <p className="text-center text-[11px] text-texte-secondaire">{t("mention")}</p>
    </section>
  );
}
