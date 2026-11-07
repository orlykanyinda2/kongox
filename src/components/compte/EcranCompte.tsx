import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { lireReglages } from "@/lib/reglages";
import { lienWhatsAppEquipe } from "@/lib/partage";
import { Logo } from "@/components/Logo";
import { BoutonTheme } from "@/components/BoutonTheme";
import { FormulaireCompte } from "@/components/compte/FormulaireCompte";
import { CreerCompteInvite } from "@/components/compte/CreerCompteInvite";
import { creerClientServeur } from "@/lib/supabase/serveur";

// Déjà connecté avec un compte : direction le profil. Invité : proposition de créer son compte.
async function RedirigerSiConnecte() {
  const supabase = await creerClientServeur();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;
  // Un invité reste ici : il peut transformer son invité en compte (mêmes votes, mêmes pièces)
  const { data: u } = await supabase.from("utilisateurs").select("nom_utilisateur, invite").eq("id", id).maybeSingle<{ nom_utilisateur: string; invite: boolean }>();
  if (!u?.invite) redirect("/profil");
  return <CreerCompteInvite nom={u.nom_utilisateur} pieces={Number((await lireReglages()).bonus_inscription ?? 1000)} />;
}

// Écran d'inscription et de connexion (maquettes/Inscription.dc.html)
export async function EcranCompte({ mode }: { mode: "inscription" | "connexion" }) {
  const t = await getTranslations("compte");
  const tc = await getTranslations("commun");
  // Lien WhatsApp de l'équipe pour « Mot de passe oublié ? »
  const whatsapp = lienWhatsAppEquipe(String((await lireReglages()).whatsapp_equipe ?? ""), "Bonjour KongoX, j'ai oublié mon mot de passe. Mon nom d'utilisateur : ");

  return (
    <main className="relative flex-1 overflow-hidden">

      {/* Formes qui flottent */}
      <div aria-hidden="true" className="absolute right-5 top-[70px] size-10 animate-flotte rounded-full border-[10px] border-vert-jaune" />
      <div aria-hidden="true" className="absolute left-[22px] top-[150px] size-[26px] animate-tourne rounded-lg border-2 border-foret bg-brique" />
      <div aria-hidden="true" className="absolute -bottom-[60px] -right-[50px] size-40 animate-flotte-lent rounded-full bg-sauge" />

      <div className="relative mx-auto flex w-full max-w-[440px] flex-col gap-[18px] p-[18px] pb-12">
        <div className="flex items-center justify-between pt-2">
          <span className="size-11" aria-hidden="true" />
          <Logo libelle={tc("accueilLogo")} />
          <BoutonTheme />
        </div>

        <h1 className="mt-[18px] animate-monte text-center text-[34px] leading-[1.05] tracking-[-1px]">
          {t("titre")}
          <br />
          <span className="mt-2.5 inline-block animate-rebond rounded-2xl border-[3px] border-foret bg-vert-jaune px-3.5 pb-1.5 pt-0.5 text-foret shadow-[5px_5px_0_#1F3A26]">
            {t("piecesOffertes")}
          </span>
        </h1>

        <Suspense fallback={null}>
          <RedirigerSiConnecte />
        </Suspense>

        <FormulaireCompte modeInitial={mode} />

        <div className="flex items-start gap-2.5 rounded-champ border-2 border-dashed border-sauge bg-doux p-3.5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px flex-none text-hunter dark:text-vert-jaune">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <p className="text-[13px] leading-[1.45]">
            <strong>{t("mdpOublie")}</strong>{" "}
            {t.rich("mdpOublieTexte", {
              whatsapp: (morceau) =>
                whatsapp ? (
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                    {morceau}
                  </a>
                ) : (
                  <strong>{morceau}</strong>
                ),
            })}
          </p>
        </div>

        <p className="text-center text-xs text-texte-secondaire">{t("jamaisArgentReel")}</p>
      </div>
    </main>
  );
}
