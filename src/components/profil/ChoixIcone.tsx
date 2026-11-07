"use client";

import { useRef, useState, useTransition } from "react";
import { acheterIcone, choisirIcone, enregistrerPhoto, retirerMaPhoto, type EtatIcone } from "@/app/actions/icones";
import { Avatar } from "./Avatar";

export type IconeListe = {
  code: string;
  nom: string;
  niveau: "gratuite" | "elite" | "boutique";
  prix: number;
  badge_nom: string | null;
  disponible: boolean;
};

type Props = {
  utilisateurId: string;
  nom: string;
  actuelle: string | null;
  photo: string | null;
  solde: number;
  invite: boolean;
  icones: IconeListe[];
};

const nombre = new Intl.NumberFormat("fr-FR");
const TITRES = { gratuite: "Gratuites", elite: "Élite (débloquées par un badge)", boutique: "Boutique (pièces gratuites)" } as const;
const TAILLE_MAX = 500 * 1024;

// Recadre au centre en carré 512 × 512 et compresse en WebP (ou JPEG si WebP n'est pas possible), < 500 Ko
async function preparerPhoto(fichier: File): Promise<Blob> {
  const image = await createImageBitmap(fichier);
  const cote = Math.min(image.width, image.height);
  const toile = document.createElement("canvas");
  toile.width = 512;
  toile.height = 512;
  const ctx = toile.getContext("2d");
  if (!ctx) throw new Error("toile");
  ctx.drawImage(image, (image.width - cote) / 2, (image.height - cote) / 2, cote, cote, 0, 0, 512, 512);
  for (const [type, qualite] of [["image/webp", 0.85], ["image/webp", 0.7], ["image/jpeg", 0.75], ["image/jpeg", 0.6]] as const) {
    const blob = await new Promise<Blob | null>((ok) => toile.toBlob(ok, type, qualite));
    if (blob && blob.size <= TAILLE_MAX && blob.type === type) return blob;
  }
  throw new Error("trop_grande");
}

export function ChoixIcone({ utilisateurId, nom, actuelle, photo, solde, invite, icones }: Props) {
  const [etat, setEtat] = useState<EtatIcone>({});
  const [enCours, demarrer] = useTransition();
  const [achat, setAchat] = useState<IconeListe | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  const actuelleInfo = icones.find((i) => i.code === actuelle);

  const lancer = (f: () => Promise<EtatIcone>) => demarrer(async () => setEtat(await f()));

  const envoyerPhoto = (fichier: File | undefined) => {
    if (!fichier) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(fichier.type)) {
      setEtat({ erreur: "Formats acceptés : jpg, png ou webp." });
      return;
    }
    lancer(async () => {
      try {
        const blob = await preparerPhoto(fichier);
        const extension = blob.type === "image/webp" ? "webp" : "jpg";
        const chemin = `${utilisateurId}/${Date.now().toString(36)}.${extension}`;
        const { creerClientNavigateur } = await import("@/lib/supabase/client");
        const { error } = await creerClientNavigateur().storage.from("avatars").upload(chemin, blob, { contentType: blob.type, upsert: false });
        if (error) return { erreur: "L'envoi de la photo a échoué. Réessaie." };
        return await enregistrerPhoto(chemin);
      } catch (e) {
        return { erreur: e instanceof Error && e.message === "trop_grande" ? "Photo trop lourde, même compressée. Choisis-en une autre." : "Cette image n'a pas pu être lue." };
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-center gap-5 rounded-carte border-2 border-contour bg-surface p-5 shadow-decale-md">
        <Avatar nom={nom} icone={actuelle} photo={photo} elite={!photo && actuelleInfo?.niveau === "elite"} taille={96} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl">@{nom}</h2>
          <p className="text-sm text-texte-secondaire">{photo ? "Ta photo est affichée." : `Icône : ${actuelleInfo?.nom ?? "—"}`}</p>
          <p className="mt-1 text-sm font-semibold">{nombre.format(solde)} pièces</p>
        </div>
        {!invite && (
          <div className="flex flex-col gap-2">
            <input ref={champ} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => envoyerPhoto(e.target.files?.[0])} aria-label="Choisir une photo" />
            <button type="button" disabled={enCours} onClick={() => champ.current?.click()} className="h-11 rounded-bouton bg-foret px-4 text-sm font-bold text-white disabled:opacity-60 dark:bg-vert-jaune dark:text-foret">
              {photo ? "Changer ma photo" : "Mettre ma photo"}
            </button>
            {photo && (
              <button type="button" disabled={enCours} onClick={() => lancer(retirerMaPhoto)} className="h-11 rounded-bouton border border-separateur px-4 text-sm font-bold">
                Retirer ma photo
              </button>
            )}
          </div>
        )}
      </section>
      {!invite && (
        <p className="-mt-3 text-[13px] text-texte-secondaire">
          Photo : jpg, png ou webp, recadrée en carré et compressée (500 Ko au maximum). Interdit : nudité, violence, insultes. Une photo signalée plusieurs fois est retirée.
        </p>
      )}

      {(etat.erreur || etat.succes || enCours) && (
        <p role={etat.erreur ? "alert" : "status"} className={`rounded-champ px-4 py-3 text-sm font-bold ${etat.erreur ? "bg-brique text-white" : "bg-vert-jaune text-foret"}`}>
          {enCours ? "Un instant…" : (etat.erreur ?? etat.succes)}
        </p>
      )}

      {(["gratuite", "elite", "boutique"] as const).map((niveau) => (
        <section key={niveau} aria-labelledby={`icones-${niveau}`}>
          <h2 id={`icones-${niveau}`} className="text-xl">
            {TITRES[niveau]}
          </h2>
          <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {icones
              .filter((i) => i.niveau === niveau)
              .map((i) => {
                const portee = !photo && i.code === actuelle;
                return (
                  <li key={i.code}>
                    <button
                      type="button"
                      disabled={enCours || portee}
                      onClick={() => {
                        setEtat({});
                        if (i.disponible) lancer(() => choisirIcone(i.code));
                        else if (i.niveau === "boutique") setAchat(i);
                      }}
                      aria-pressed={portee}
                      className={`flex w-full flex-col items-center gap-1.5 rounded-[16px] border-2 p-2.5 text-center ${portee ? "border-foret bg-vert-jaune text-foret" : "border-contour bg-surface"} ${
                        !i.disponible && i.niveau === "elite" ? "cursor-not-allowed" : ""
                      }`}
                    >
                      <Avatar nom={null} icone={i.code} photo={null} elite={i.niveau === "elite"} taille={56} className={!i.disponible && i.niveau === "elite" ? "opacity-40 grayscale" : ""} />
                      <span className="text-xs font-bold leading-tight">{i.nom}</span>
                      <span className="text-[11px] leading-tight text-texte-secondaire">
                        {portee
                          ? "Ton icône"
                          : i.disponible
                            ? "Choisir"
                            : i.niveau === "boutique"
                              ? invite
                                ? "Compte requis"
                                : `${nombre.format(i.prix)} pièces`
                              : `Badge « ${i.badge_nom ?? "?"} »`}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      {achat && (
        <div role="dialog" aria-modal="true" aria-labelledby="titre-achat" className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-carte border-2 border-foret bg-surface p-6 text-center">
            <Avatar nom={null} icone={achat.code} photo={null} taille={80} />
            <h2 id="titre-achat" className="text-xl">
              {achat.nom}
            </h2>
            {invite ? (
              <p className="text-[15px]">Crée ton compte pour acheter des icônes avec tes pièces.</p>
            ) : (
              <p className="text-[15px]">
                Acheter cette icône pour <strong>{nombre.format(achat.prix)} pièces</strong> ? Tu as {nombre.format(solde)} pièces. Les pièces sont gratuites et ne s&apos;achètent jamais.
              </p>
            )}
            <div className="flex w-full gap-2">
              <button type="button" onClick={() => setAchat(null)} className="h-12 flex-1 rounded-bouton border border-separateur font-bold">
                Annuler
              </button>
              {invite ? (
                <a href="/inscription" className="flex h-12 flex-1 items-center justify-center rounded-bouton bg-foret font-bold text-white">
                  Crée ton compte
                </a>
              ) : (
                <button
                  type="button"
                  disabled={solde < achat.prix}
                  onClick={() => {
                    const code = achat.code;
                    setAchat(null);
                    lancer(() => acheterIcone(code));
                  }}
                  className="h-12 flex-1 rounded-bouton bg-foret font-bold text-white disabled:opacity-50 dark:bg-vert-jaune dark:text-foret"
                >
                  {solde < achat.prix ? "Pas assez de pièces" : "Acheter"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
