"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { chargerVotes } from "@/app/actions/votes";
import type { Vote } from "@/lib/votes/donnees";
import { Avatar } from "@/components/profil/Avatar";

type Props = {
  marche: number;
  options: { ordre: number; libelle: string }[]; // OUI / NON, ou 1 / N / 2
  initiaux: Vote[];
  total: number;
  suivis: number; // personnes que je suis qui ont voté
};

const heure = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kinshasa" });
const nombre = new Intl.NumberFormat("fr-FR");
const BADGES = ["bg-oui-fond text-oui-texte", "bg-brique text-white", "bg-brique text-white"];
const BADGES_1N2 = ["bg-oui-fond text-oui-texte", "bg-champagne text-foret", "bg-brique text-white"];

// « Qui a voté » (toujours public) : filtres OUI / NON / tous (ou 1 / N / 2), tri récents ou plus grosses mises
export function QuiAVote({ marche, options, initiaux, total: totalInitial, suivis }: Props) {
  const [votes, setVotes] = useState(initiaux);
  const [total, setTotal] = useState(totalInitial);
  const [filtre, setFiltre] = useState<number | null>(null);
  const [tri, setTri] = useState<"recents" | "mises">("recents");
  const [enCours, demarrer] = useTransition();
  const couleurs = options.length === 3 ? BADGES_1N2 : BADGES;

  const charger = (f: number | null, t: "recents" | "mises", suite: boolean) =>
    demarrer(async () => {
      const r = await chargerVotes(marche, f, t, suite ? votes.length : 0);
      setVotes((avant) => (suite ? [...avant, ...r.votes.filter((v) => !avant.some((a) => a.id === v.id))] : r.votes));
      setTotal(r.total);
    });

  const puce = (actif: boolean) =>
    `h-10 rounded-full border px-3.5 text-sm font-bold ${actif ? "border-foret bg-foret text-white dark:border-vert-jaune dark:bg-vert-jaune dark:text-foret" : "border-separateur bg-surface text-texte"}`;

  return (
    <section aria-labelledby="titre-votes" className="flex flex-col gap-3">
      <div>
        <h2 id="titre-votes" className="text-xl">
          Qui a voté · {nombre.format(totalInitial)}
        </h2>
        {suivis > 0 && (
          <p className="mt-0.5 text-sm font-semibold text-hunter dark:text-vert-jaune">
            {suivis === 1 ? "1 personne que tu suis a voté" : `${nombre.format(suivis)} personnes que tu suis ont voté`}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer les votes">
        <button type="button" aria-pressed={filtre === null} className={puce(filtre === null)} onClick={() => (setFiltre(null), charger(null, tri, false))}>
          Tous
        </button>
        {options.map((o) => (
          <button key={o.ordre} type="button" aria-pressed={filtre === o.ordre} className={puce(filtre === o.ordre)} onClick={() => (setFiltre(o.ordre), charger(o.ordre, tri, false))}>
            {o.libelle}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-sm">
          <span className="text-texte-secondaire">Trier</span>
          <select
            value={tri}
            onChange={(e) => {
              const t = e.target.value === "mises" ? "mises" : "recents";
              setTri(t);
              charger(filtre, t, false);
            }}
            className="h-10 rounded-bouton border border-separateur bg-surface px-2 text-sm"
          >
            <option value="recents">Plus récents</option>
            <option value="mises">Plus grosses mises</option>
          </select>
        </label>
      </div>

      {votes.length === 0 ? (
        <p className="rounded-[16px] border-2 border-dashed border-sauge bg-doux p-4 text-center text-sm">
          {enCours ? "Chargement…" : "Personne n'a encore voté ici. Sois le premier !"}
        </p>
      ) : (
        <ul className={`flex flex-col divide-y divide-separateur rounded-[16px] border-2 border-contour bg-surface ${enCours ? "opacity-60" : ""}`} aria-busy={enCours}>
          {votes.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <Avatar nom={v.nom} icone={v.icone} photo={v.photo} elite={v.elite} taille={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {v.nom ? (
                    <Link href={`/u/${v.nom}`}>@{v.nom}</Link>
                  ) : (
                    "invité"
                  )}
                  {v.nom && v.invite && <span className="ml-1.5 text-xs font-semibold text-texte-secondaire">invité</span>}
                </p>
                <p className="text-xs text-texte-secondaire">
                  <time dateTime={v.cree_le}>{heure.format(new Date(v.cree_le))}</time> · {nombre.format(v.montant)} pièces
                </p>
              </div>
              <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-bold ${couleurs[v.ordre] ?? "bg-doux"}`}>{v.choix}</span>
            </li>
          ))}
        </ul>
      )}

      {votes.length < total && (
        <button type="button" disabled={enCours} onClick={() => charger(filtre, tri, true)} className="h-11 self-center rounded-bouton border border-separateur px-4 text-sm font-bold disabled:opacity-60">
          {enCours ? "Chargement…" : "Voir plus de votes"}
        </button>
      )}
    </section>
  );
}
