"use client";

import { useActionState, useEffect, useState } from "react";
import { envoyerDemande, type EtatDemande } from "@/app/actions/partenaires";
import { TYPES_PARTENARIAT, estTypePartenariat, type TypePartenariat } from "@/lib/partenaires";

const CHAMP = "w-full rounded-champ border-2 border-foret bg-white px-3.5 text-[15px] text-foret outline-none focus-visible:ring-4 focus-visible:ring-vert-jaune/60";
const LIBELLE = "mb-1.5 block text-sm font-bold text-white";

// Formulaire « Parlons de votre projet » (maquette Partenaires). Le type suit le bouton cliqué (#contact?type=…).
export function FormulairePartenaire({ typeInitial }: { typeInitial: TypePartenariat }) {
  const [etat, action, enCours] = useActionState<EtatDemande, FormData>(envoyerDemande, {});
  const [type, setType] = useState<TypePartenariat>(typeInitial);

  // Les boutons des offres changent le type sans recharger la page
  useEffect(() => {
    const surClic = (e: MouseEvent) => {
      const lien = (e.target as Element | null)?.closest?.("a[data-type-partenariat]");
      const t = lien?.getAttribute("data-type-partenariat");
      if (estTypePartenariat(t)) setType(t);
    };
    document.addEventListener("click", surClic);
    return () => document.removeEventListener("click", surClic);
  }, []);

  if (etat.succes) {
    return (
      <div role="status" className="flex min-w-0 flex-[1_1_420px] flex-col justify-center gap-2 rounded-[18px] border-2 border-foret bg-white p-6 text-foret">
        <strong className="font-titre text-2xl">Merci, c&apos;est envoyé !</strong>
        <p className="text-[15px]">L&apos;équipe KongoX te répond sous 48 h, sur WhatsApp ou par e-mail.</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid min-w-0 flex-[1_1_420px] grid-cols-1 gap-3.5 sm:grid-cols-2">
      <div>
        <label htmlFor="partenaire-nom" className={LIBELLE}>
          Nom
        </label>
        <input id="partenaire-nom" name="nom" required minLength={2} maxLength={80} autoComplete="name" className={`${CHAMP} h-12`} />
      </div>
      <div>
        <label htmlFor="partenaire-org" className={LIBELLE}>
          Entreprise ou page
        </label>
        <input id="partenaire-org" name="organisation" maxLength={120} autoComplete="organization" className={`${CHAMP} h-12`} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="partenaire-type" className={LIBELLE}>
          Type de partenariat
        </label>
        <select id="partenaire-type" name="type" value={type} onChange={(e) => setType(e.target.value as TypePartenariat)} className={`${CHAMP} h-12`}>
          {Object.entries(TYPES_PARTENARIAT).map(([cle, libelle]) => (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="partenaire-contact" className={LIBELLE}>
          WhatsApp ou e-mail (pour te répondre)
        </label>
        <input id="partenaire-contact" name="contact" required minLength={5} maxLength={120} placeholder="+243 81 234 5678 ou nom@exemple.com" className={`${CHAMP} h-12`} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="partenaire-message" className={LIBELLE}>
          Message
        </label>
        <textarea id="partenaire-message" name="message" required minLength={10} maxLength={2000} rows={4} className={`${CHAMP} resize-none py-3`} />
      </div>
      {/* Piège à robots : invisible pour les personnes */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="partenaire-site">Site web</label>
        <input id="partenaire-site" name="site_web" tabIndex={-1} autoComplete="off" />
      </div>
      {etat.erreur && (
        <p role="alert" className="rounded-champ bg-white px-3.5 py-2.5 text-sm font-bold text-brique sm:col-span-2">
          {etat.erreur}
        </p>
      )}
      <button
        type="submit"
        disabled={enCours}
        className="h-[54px] rounded-champ border-2 border-foret bg-white text-base font-bold text-foret shadow-[4px_4px_0_#1F3A26] disabled:opacity-60 sm:col-span-2"
      >
        {enCours ? "Envoi…" : "Envoyer ma demande"}
      </button>
    </form>
  );
}
