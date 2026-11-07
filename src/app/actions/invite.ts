"use server";

import { createHmac, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { refresh, updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { emailCache, nomValide, nomReserve, MDP_LONGUEUR_MAX, MDP_LONGUEUR_MIN } from "@/lib/compte/nomUtilisateur";

// Invités : voter avec un simple pseudo (200 pièces d'essai), puis créer un compte en gardant tout.
// L'invité est un vrai compte Supabase marqué « invité », créé côté serveur (clé service role).
// L'appareil est reconnu par un cookie aléatoire ; appareil et adresse IP ne sont gardés que hachés.

export type EtatInvite = { erreur?: string; succes?: boolean; nom?: string };

const COOKIE_APPAREIL = "kx_appareil";

// Empreinte non réversible (HMAC avec la clé du serveur) : on ne garde jamais l'IP ni l'identifiant en clair
function empreinte(valeur: string) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "kongox").update(valeur).digest("hex");
}

async function adresseIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "inconnue").trim();
}

// Mot de passe technique de l'invité : jamais montré, renouvelé à chaque reconnexion de l'appareil
function motDePasseTechnique() {
  return randomBytes(24).toString("base64url");
}

export async function voterEnInvite(_etat: EtatInvite, donnees: FormData): Promise<EtatInvite> {
  const t = await getTranslations("invite");
  const nom = String(donnees.get("nom") ?? "").trim().replace(/^@/, "");
  if (!nomValide(nom) || nomReserve(nom)) return { erreur: t("nomFormat"), nom };

  const supabase = await creerClientServeur();
  const { data: session } = await supabase.auth.getClaims();
  if (session?.claims?.sub) return { succes: true }; // déjà connecté (compte ou invité)

  // Identifiant de l'appareil : cookie aléatoire, 1 an
  const magasin = await cookies();
  let appareil = magasin.get(COOKIE_APPAREIL)?.value;
  if (!appareil || !/^[a-f0-9]{64}$/.test(appareil)) {
    appareil = randomBytes(32).toString("hex");
    magasin.set(COOKIE_APPAREIL, appareil, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }
  const appareilHash = empreinte(`appareil:${appareil}`);
  const ipHash = empreinte(`ip:${await adresseIp()}`);
  const admin = creerClientAdmin();

  const { data: prep, error: erreurPrep } = await admin.rpc("preparer_invite", { p_appareil_hash: appareilHash, p_ip_hash: ipHash });
  if (erreurPrep) {
    if (erreurPrep.hint === "limite_invites") return { erreur: t("limite"), nom };
    console.error("[invité] préparation :", erreurPrep.message);
    return { erreur: t("serveur"), nom };
  }

  // Un seul invité par appareil : s'il existe déjà, on le reconnecte (avec son pseudo à lui)
  const existant = (prep as { existant: string | null }).existant;
  const mdp = motDePasseTechnique();
  let email: string;
  if (existant) {
    const { data: u, error } = await admin.auth.admin.updateUserById(existant, { password: mdp });
    if (error || !u.user?.email) {
      console.error("[invité] reconnexion :", error?.message);
      return { erreur: t("serveur"), nom };
    }
    email = u.user.email;
  } else {
    const { data: libre } = await admin.rpc("nom_utilisateur_disponible", { p_nom: nom });
    if (!libre) return { erreur: t("nomPris"), nom };
    email = emailCache(nom);
    const { data: cree, error } = await admin.auth.admin.createUser({
      email,
      password: mdp,
      email_confirm: true,
      user_metadata: { nom_utilisateur: nom, invite: true },
    });
    if (error || !cree.user) {
      console.error("[invité] création :", error?.code, error?.message);
      return { erreur: error?.code === "email_exists" ? t("nomPris") : t("serveur"), nom };
    }
    await admin.rpc("lier_appareil_invite", { p_appareil_hash: appareilHash, p_ip_hash: ipHash, p_utilisateur: cree.user.id });
  }

  const { error: erreurConnexion } = await supabase.auth.signInWithPassword({ email, password: mdp });
  if (erreurConnexion) {
    console.error("[invité] connexion :", erreurConnexion.code, erreurConnexion.message);
    return { erreur: t("serveur"), nom };
  }
  refresh();
  return { succes: true, nom };
}

// L'invité crée son compte : même identifiant, donc mêmes votes, pièces et pseudo ; + pièces d'inscription
export async function creerCompteDepuisInvite(_etat: EtatInvite, donnees: FormData): Promise<EtatInvite> {
  const t = await getTranslations("erreurs");
  const ti = await getTranslations("invite");
  const motDePasse = String(donnees.get("mot_de_passe") ?? "");
  const confirmation = String(donnees.get("confirmation") ?? "");
  if (motDePasse.length < MDP_LONGUEUR_MIN || motDePasse.length > MDP_LONGUEUR_MAX) return { erreur: t("mdpLongueur", { min: MDP_LONGUEUR_MIN }) };
  if (motDePasse !== confirmation) return { erreur: t("mdpDifferents") };

  const supabase = await creerClientServeur();
  const { data: session } = await supabase.auth.getClaims();
  const id = session?.claims?.sub;
  if (!id) return { erreur: t("connexionRequise") };
  const { data: u } = await supabase.from("utilisateurs").select("nom_utilisateur, invite").eq("id", id).maybeSingle<{ nom_utilisateur: string; invite: boolean }>();
  if (!u?.invite) return { erreur: ti("dejaCompte2") };

  const admin = creerClientAdmin();
  const { error: erreurMdp } = await admin.auth.admin.updateUserById(id, { password: motDePasse, user_metadata: { nom_utilisateur: u.nom_utilisateur, invite: false } });
  if (erreurMdp) {
    console.error("[invité] mot de passe :", erreurMdp.message);
    return { erreur: t("serveur") };
  }
  const { error } = await admin.rpc("convertir_invite", { p_utilisateur: id });
  if (error) {
    console.error("[invité] conversion :", error.message);
    return { erreur: t("serveur") };
  }
  updateTag("marches");
  refresh();
  return { succes: true, nom: u.nom_utilisateur };
}
