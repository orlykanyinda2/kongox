"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { changerRole, reinitialiserMotDePasse, type EtatAction, type EtatMotDePasse } from "@/app/actions/admin";
import { ajusterPieces, bonusEnMasse } from "@/app/actions/backoffice";
import { formaterNombre } from "@/lib/format";
import { cls } from "./ui";

function Message({ etat }: { etat: EtatAction }) {
  if (!etat.erreur && !etat.succes) return null;
  return (
    <p role={etat.erreur ? "alert" : "status"} className={`text-[13px] font-medium ${etat.erreur ? "text-adm-danger" : "text-adm-accent"}`}>
      {etat.erreur ?? etat.succes}
    </p>
  );
}

// Réinitialiser un mot de passe (mot de passe temporaire à envoyer en privé)
export function FormulaireMotDePasse({ nom = "" }: { nom?: string }) {
  const [etat, action, enCours] = useActionState<EtatMotDePasse, FormData>(reinitialiserMotDePasse, {});
  const [copie, setCopie] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <label className={`${cls.label} min-w-[200px] flex-1`}>
          Nom d&apos;utilisateur
          <input name="nom" defaultValue={nom} required autoComplete="off" autoCapitalize="none" placeholder="ex. Kin_la_Belle" className={`${cls.champ} mt-1`} />
        </label>
        <button type="submit" disabled={enCours} className={cls.secondaire}>
          {enCours ? "…" : "Générer un mot de passe temporaire"}
        </button>
      </form>
      {etat.erreur && <Message etat={etat} />}
      {etat.motDePasse && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-[#cfe0c8] bg-[#f1f6ee] px-3 py-2 text-[13px]">
          Nouveau mot de passe de @{etat.nom} :<code className="select-all rounded bg-white px-1.5 py-0.5 text-sm font-semibold">{etat.motDePasse}</code>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(etat.motDePasse!);
              setCopie(true);
            }}
            className="rounded border border-adm-bordure bg-white px-2 py-0.5 text-xs font-semibold"
          >
            {copie ? "Copié" : "Copier"}
          </button>
          <span className="w-full text-xs text-adm-secondaire">Envoie-le en privé sur WhatsApp. La personne le change ensuite dans « Mon profil ».</span>
        </div>
      )}
    </div>
  );
}

export function FormulaireRole({ utilisateur, role }: { utilisateur: string; role: string }) {
  const [etat, action, enCours] = useActionState<EtatAction, FormData>(changerRole.bind(null, utilisateur), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className={cls.label}>
        Rôle
        <select name="role" defaultValue={role} className={`${cls.champ} mt-1 w-44`}>
          <option value="utilisateur">Utilisateur</option>
          <option value="curateur">Curateur</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <button type="submit" disabled={enCours} className={cls.secondaire}>
        Changer le rôle
      </button>
      <div className="w-full">
        <Message etat={etat} />
      </div>
    </form>
  );
}

// Ajouter ou retirer des pièces : formulaire, puis fenêtre de confirmation qui résume l'opération
export function FormulaireAjustement({ nom = "", max }: { nom?: string; max: number }) {
  const formulaire = useRef<HTMLFormElement>(null);
  const dialogue = useRef<HTMLDialogElement>(null);
  const [resume, setResume] = useState("");
  const [retrait, setRetrait] = useState(false);
  const [etat, setEtat] = useState<EtatAction>({});
  const [enCours, demarrer] = useTransition();

  return (
    <>
      <form
        ref={formulaire}
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          const sens = d.get("sens") === "retirer";
          setRetrait(sens);
          setResume(`${sens ? "Retirer" : "Ajouter"} ${formaterNombre(Number(d.get("montant")))} pièces ${sens ? "à" : "à"} @${String(d.get("nom")).replace(/^@/, "")} — raison : « ${d.get("raison")} »`);
          dialogue.current?.showModal();
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <label className={cls.label}>
          Nom d&apos;utilisateur
          <input name="nom" defaultValue={nom} required autoCapitalize="none" className={`${cls.champ} mt-1`} />
        </label>
        <fieldset>
          <legend className={cls.label}>Opération</legend>
          <div className="mt-2 flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="sens" value="ajouter" defaultChecked className="accent-adm-accent" /> Ajouter
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="sens" value="retirer" className="accent-adm-danger" /> Retirer
            </label>
          </div>
        </fieldset>
        <label className={cls.label}>
          Montant (pièces)
          <input name="montant" type="number" min={1} max={max} required className={`${cls.champ} mt-1`} />
          <span className={cls.aide}>Maximum {formaterNombre(max)} (réglable). Le solde ne peut jamais devenir négatif.</span>
        </label>
        <label className={cls.label}>
          Raison (obligatoire, visible dans l&apos;historique du compte)
          <input name="raison" required minLength={3} maxLength={200} className={`${cls.champ} mt-1`} />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className={cls.principal}>
            Vérifier et confirmer…
          </button>
          <Message etat={etat} />
        </div>
      </form>
      <dialog ref={dialogue} className="m-auto w-[min(440px,calc(100vw-32px))] rounded-lg border border-adm-bordure bg-white p-5 text-adm-texte backdrop:bg-black/40">
        <h2 className="text-base font-semibold">Confirmer l&apos;ajustement</h2>
        <p className="mt-2 text-sm">{resume}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => dialogue.current?.close()} className={cls.secondaire}>
            Annuler
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const r = await ajusterPieces(new FormData(formulaire.current!));
                setEtat(r);
                dialogue.current?.close();
                if (!r.erreur) formulaire.current?.reset();
              })
            }
            className={retrait ? cls.danger : cls.principal}
          >
            {enCours ? "…" : "Confirmer"}
          </button>
        </div>
      </dialog>
    </>
  );
}

// Bonus en masse : liste de noms, ou tous les comptes actifs (7 / 30 jours)
export function FormulaireBonusMasse({ communautes = [] }: { communautes?: { id: number; nom: string }[] }) {
  const formulaire = useRef<HTMLFormElement>(null);
  const dialogue = useRef<HTMLDialogElement>(null);
  const [cible, setCible] = useState("liste");
  const [resume, setResume] = useState("");
  const [etat, setEtat] = useState<EtatAction>({});
  const [enCours, demarrer] = useTransition();

  return (
    <>
      <form
        ref={formulaire}
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          const noms = String(d.get("noms") ?? "").split(/[\s,;]+/).filter(Boolean).length;
          const qui =
            cible === "liste"
              ? `${noms} nom(s) de la liste`
              : cible === "actifs_7j"
                ? "tous les comptes actifs ces 7 derniers jours"
                : cible === "actifs_30j"
                  ? "tous les comptes actifs ces 30 derniers jours"
                  : cible === "communaute"
                    ? `tous les membres de « ${communautes.find((c) => String(c.id) === d.get("communaute"))?.nom ?? "?"} »`
                    : `les ${d.get("top")} premiers du classement (${d.get("periode") === "mois" ? "mois" : d.get("periode") === "tout" ? "depuis le début" : "semaine"})`;
          setResume(`Verser ${formaterNombre(Number(d.get("montant")))} pièces à ${qui} (jamais à toi-même). Raison : « ${d.get("raison")} ».`);
          dialogue.current?.showModal();
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <label className={cls.label}>
          Destinataires
          <select name="cible" value={cible} onChange={(e) => setCible(e.target.value)} className={`${cls.champ} mt-1`}>
            <option value="liste">Une liste de noms</option>
            <option value="actifs_7j">Comptes actifs (7 jours)</option>
            <option value="actifs_30j">Comptes actifs (30 jours)</option>
            <option value="communaute">Une communauté</option>
            <option value="top">Les N premiers du classement</option>
          </select>
        </label>
        <label className={cls.label}>
          Montant par compte (1 à 10 000)
          <input name="montant" type="number" min={1} max={10000} required className={`${cls.champ} mt-1`} />
        </label>
        {cible === "communaute" && (
          <label className={`${cls.label} sm:col-span-2`}>
            Communauté
            <select name="communaute" required className={`${cls.champ} mt-1`}>
              {communautes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>
        )}
        {cible === "top" && (
          <>
            <label className={cls.label}>
              Combien de premiers (1 à 200)
              <input name="top" type="number" min={1} max={200} defaultValue={10} required className={`${cls.champ} mt-1`} />
            </label>
            <label className={cls.label}>
              Classement
              <select name="periode" defaultValue="semaine" className={`${cls.champ} mt-1`}>
                <option value="semaine">De la semaine</option>
                <option value="mois">Du mois</option>
                <option value="tout">Depuis le début</option>
              </select>
            </label>
          </>
        )}
        {cible === "liste" && (
          <label className={`${cls.label} sm:col-span-2`}>
            Noms d&apos;utilisateur (séparés par des espaces, virgules ou retours à la ligne)
            <textarea name="noms" rows={3} required className={`${cls.zoneTexte} mt-1`} />
          </label>
        )}
        <label className={`${cls.label} sm:col-span-2`}>
          Raison (obligatoire)
          <input name="raison" required minLength={3} maxLength={200} placeholder="Ex. : top 10 de la semaine" className={`${cls.champ} mt-1`} />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className={cls.principal}>
            Vérifier et confirmer…
          </button>
          <Message etat={etat} />
        </div>
      </form>
      <dialog ref={dialogue} className="m-auto w-[min(440px,calc(100vw-32px))] rounded-lg border border-adm-bordure bg-white p-5 text-adm-texte backdrop:bg-black/40">
        <h2 className="text-base font-semibold">Confirmer le bonus en masse</h2>
        <p className="mt-2 text-sm">{resume}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => dialogue.current?.close()} className={cls.secondaire}>
            Annuler
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const r = await bonusEnMasse(new FormData(formulaire.current!));
                setEtat(r);
                dialogue.current?.close();
                if (!r.erreur) formulaire.current?.reset();
              })
            }
            className={cls.principal}
          >
            {enCours ? "…" : "Verser le bonus"}
          </button>
        </div>
      </dialog>
    </>
  );
}
