"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { CibleSalon, MessageChat } from "@/lib/chat/donnees";

// Salon de chat (maquette Marche : « Commentaires », cartes avec badge OUI / NON).
// Les messages arrivent en direct (Supabase Realtime). Pour garder la page légère,
// le client Supabase n'est chargé que lorsque le salon devient visible à l'écran.

export type EtatEcriture = "ok" | "connexion" | "membres" | "bloque";

type Props = {
  cible: CibleSalon;
  type: "marche" | "match" | "communaute";
  initiaux: MessageChat[];
  total: number;
  ecriture: EtatEcriture;
  moi: string | null;
  longueurMax: number;
};

const CHAMPS = "id, marche_id, communaute_id, auteur_nom, choix, texte, masque, cree_le";
const PAR_PAGE = 30;
const MOTIFS = ["insulte", "arnaque", "spam", "ligne_rouge", "autre"] as const;
const heure = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kinshasa" });

// OUI vert, NON brique ; match : 1 vert, N clair, 2 brique (toujours avec le texte écrit)
const BADGES: Record<string, string> = {
  OUI: "bg-oui-fond text-oui-texte",
  "1": "bg-oui-fond text-oui-texte",
  N: "bg-champagne text-foret",
  NON: "bg-brique text-white",
  "2": "bg-brique text-white",
};

let clientPromis: Promise<SupabaseClient> | null = null;
function client() {
  clientPromis ??= import("@/lib/supabase/client").then((m) => m.creerClientNavigateur());
  return clientPromis;
}

export function Salon({ cible, type, initiaux, total: totalInitial, ecriture, moi, longueurMax }: Props) {
  const t = useTranslations("chat");
  const [messages, setMessages] = useState<MessageChat[]>(initiaux);
  const [total, setTotal] = useState(totalInitial);
  const [plusAnciens, setPlusAnciens] = useState(initiaux.length >= PAR_PAGE);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enDirect, setEnDirect] = useState(false);
  const [signalement, setSignalement] = useState<number | null>(null);
  const [retours, setRetours] = useState<Record<number, string>>({});
  const zone = useRef<HTMLElement>(null);
  const connus = useRef(new Set(initiaux.map((m) => m.id)));

  const colonne = "marche" in cible ? "marche_id" : "communaute_id";
  const valeur = "marche" in cible ? cible.marche : cible.communaute;

  // Ajoute ou remplace des messages (du plus récent au plus ancien, sans doublon)
  const fusionner = (nouveaux: MessageChat[]) => {
    for (const m of nouveaux) connus.current.add(m.id);
    setMessages((avant) => {
      const parId = new Map(avant.map((m) => [m.id, m]));
      for (const m of nouveaux) parId.set(m.id, m);
      return [...parId.values()].sort((a, b) => b.id - a.id);
    });
  };

  // Nouveau message (envoyé par moi ou reçu en direct), compté une seule fois
  const ajouter = (m: MessageChat) => {
    if (connus.current.has(m.id)) return;
    connus.current.add(m.id);
    setMessages((avant) => [m, ...avant]);
    if (!m.masque) setTotal((n) => n + 1);
  };

  // Connexion en direct quand le salon devient visible
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    let canal: RealtimeChannel | null = null;
    let fini = false;
    const brancher = async () => {
      const supabase = await client();
      if (fini) return;
      canal = supabase
        .channel(`salon-${colonne}-${valeur}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "messages_chat", filter: `${colonne}=eq.${valeur}` }, (p) => {
          const m = p.new as MessageChat;
          if (!m?.id) return;
          if (p.eventType === "INSERT") {
            ajouter(m);
          } else {
            fusionner([m]);
            if (m.masque) setTotal((n) => Math.max(n - 1, 0));
          }
        })
        .subscribe((statut) => setEnDirect(statut === "SUBSCRIBED"));
    };
    const obs = new IntersectionObserver(
      (e) => {
        if (e[0]?.isIntersecting) {
          obs.disconnect();
          void brancher();
        }
      },
      { rootMargin: "300px 0px" },
    );
    obs.observe(el);
    return () => {
      fini = true;
      obs.disconnect();
      if (canal) void client().then((s) => s.removeChannel(canal!));
    };
  }, [colonne, valeur]);

  const messageErreur = (hint?: string | null) => {
    const connus = ["connexion_requise", "compte_suspendu", "chat_bloque", "salon_invalide", "reserve_membres", "chat_longueur", "chat_trop_vite", "chat_limite", "signalement_limite", "soi_meme", "signalement_invalide"];
    return t(`erreurs.${connus.includes(hint ?? "") ? hint : "serveur"}`, { max: longueurMax });
  };

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    const propre = texte.trim();
    if (!propre || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const supabase = await client();
      const { data, error } = await supabase.rpc("envoyer_message", {
        p_marche: "marche" in cible ? cible.marche : null,
        p_communaute: "communaute" in cible ? cible.communaute : null,
        p_texte: propre,
      });
      if (error) setErreur(messageErreur(error.hint));
      else {
        setTexte("");
        ajouter(data as MessageChat);
      }
    } catch {
      setErreur(messageErreur(null));
    } finally {
      setEnvoi(false);
    }
  };

  const chargerAnciens = async () => {
    const plusVieux = messages.at(-1)?.id;
    if (!plusVieux) return;
    const supabase = await client();
    const { data, error } = await supabase.from("messages_chat").select(CHAMPS).eq(colonne, valeur).lt("id", plusVieux).order("id", { ascending: false }).limit(PAR_PAGE);
    if (error) return setErreur(messageErreur(null));
    fusionner((data ?? []) as MessageChat[]);
    if ((data ?? []).length < PAR_PAGE) setPlusAnciens(false);
  };

  const signaler = async (id: number, motif: string) => {
    setSignalement(null);
    const supabase = await client();
    const { data, error } = await supabase.rpc("signaler", { p_message: id, p_marche: null, p_motif: motif });
    setRetours((r) => ({ ...r, [id]: error ? messageErreur(error.hint) : data === "deja" ? t("dejaSignale") : t("signale") }));
  };

  const titre = t(type === "match" ? "chatMatch" : type === "communaute" ? "salonCommunaute" : "commentaires", { nombre: total });

  return (
    <section ref={zone} id="chat" aria-labelledby="titre-chat" className="flex scroll-mt-24 flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titre-chat" className="text-xl">
          {titre}
        </h2>
        {enDirect && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-texte-secondaire">
            <span className="size-2 animate-pulse-direct rounded-full bg-brique" aria-hidden="true" />
            {t("enDirect")}
          </span>
        )}
      </div>

      {ecriture === "ok" ? (
        <form onSubmit={envoyer} className="flex flex-col gap-2">
          <label htmlFor={`message-${valeur}`} className="sr-only">
            {t("libelleChamp")}
          </label>
          <textarea
            id={`message-${valeur}`}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            maxLength={longueurMax}
            rows={2}
            placeholder={t("placeholder")}
            className="min-h-[52px] resize-y rounded-champ border border-separateur bg-champagne/50 px-3.5 py-3 text-[15px] text-texte outline-none focus-visible:ring-4 focus-visible:ring-vert-jaune/60 dark:bg-doux"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-texte-secondaire">{t("regles")}</span>
            <button
              type="submit"
              disabled={envoi || !texte.trim()}
              className="h-11 flex-none rounded-bouton bg-foret px-5 text-[15px] font-bold text-white disabled:opacity-50 dark:bg-vert-jaune dark:text-foret"
            >
              {envoi ? t("envoi") : t("envoyer")}
            </button>
          </div>
          {erreur && (
            <p role="alert" className="text-sm font-semibold text-brique">
              {erreur}
            </p>
          )}
        </form>
      ) : (
        <p className="rounded-champ bg-doux px-4 py-3 text-sm">
          {ecriture === "connexion"
            ? t.rich("connexion", { lien: (c) => <Link href="/connexion" className="font-bold underline">{c}</Link> })
            : t(ecriture === "membres" ? "membres" : "bloque")}
        </p>
      )}

      {messages.length === 0 ? (
        <p className="rounded-[16px] border-2 border-dashed border-sauge bg-doux p-4 text-center text-sm">{t("vide")}</p>
      ) : (
        <ul className="flex flex-col gap-2.5" aria-live="polite">
          {messages.map((m) => (
            <li key={m.id}>
              <article className="flex flex-col gap-1.5 rounded-[16px] border-2 border-contour bg-surface p-3.5 shadow-decale">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <Link href={`/u/${m.auteur_nom}`} className="truncate text-sm font-bold">
                      @{m.auteur_nom}
                    </Link>
                    <time dateTime={m.cree_le} className="flex-none text-xs text-texte-secondaire">
                      {heure.format(new Date(m.cree_le))}
                    </time>
                  </span>
                  {m.choix && <span className={`flex-none rounded-full px-[9px] py-[3px] text-[11px] font-bold ${BADGES[m.choix] ?? "bg-doux"}`}>{m.choix}</span>}
                </div>
                {m.masque ? (
                  <p className="text-sm italic text-texte-secondaire">{t("masque")}</p>
                ) : (
                  <p className="whitespace-pre-line break-words text-sm leading-[1.45]">{m.texte}</p>
                )}
                {!m.masque && moi && moi !== m.auteur_nom && (
                  <div className="flex flex-wrap items-center gap-2">
                    {retours[m.id] ? (
                      <span role="status" className="text-xs font-semibold text-texte-secondaire">
                        {retours[m.id]}
                      </span>
                    ) : signalement === m.id ? (
                      <div role="group" aria-label={t("signalerTitre")} className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold">{t("signalerTitre")}</span>
                        {MOTIFS.map((motif) => (
                          <button key={motif} type="button" onClick={() => signaler(m.id, motif)} className="min-h-9 rounded-full border border-separateur px-2.5 text-xs font-semibold">
                            {t(`motif_${motif}`)}
                          </button>
                        ))}
                        <button type="button" onClick={() => setSignalement(null)} className="min-h-9 px-2 text-xs underline">
                          {t("annuler")}
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setSignalement(m.id)} className="min-h-9 text-xs font-semibold text-texte-secondaire underline">
                        {t("signaler")}
                      </button>
                    )}
                  </div>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}

      {plusAnciens && messages.length > 0 && (
        <button type="button" onClick={chargerAnciens} className="h-11 self-center rounded-bouton border border-separateur px-4 text-sm font-bold">
          {t("plusAnciens")}
        </button>
      )}
    </section>
  );
}
