import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { utilisateurConnecte, type UtilisateurConnecte } from "@/lib/compte/session";
import { creerClientServeur } from "@/lib/supabase/serveur";
import type { Categorie } from "@/lib/marches/categories";

export type ThemeCurateur = { categorie: Categorie; statut: "essai" | "autonome"; decisions_validees: number };

export type AccesAdmin = {
  utilisateur: UtilisateurConnecte;
  admin: boolean;
  themes: ThemeCurateur[]; // thèmes où l'utilisateur est curateur
};

// Droits de l'utilisateur connecté sur le panneau admin (null s'il n'en a aucun).
// L'affichage s'appuie dessus, mais la vraie protection reste dans les fonctions SQL et la RLS.
export const lireAcces = cache(async (): Promise<AccesAdmin | null> => {
  const u = await utilisateurConnecte();
  if (!u) return null;
  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("curateurs")
    .select("categorie, statut, decisions_validees")
    .eq("utilisateur_id", u.id)
    .returns<ThemeCurateur[]>();
  const themes = data ?? [];
  const admin = u.role === "admin";
  if (!admin && themes.length === 0) return null;
  return { utilisateur: u, admin, themes };
});

// Admins et curateurs. Visiteur → connexion ; sans droits → page introuvable.
export async function exigerAcces(): Promise<AccesAdmin> {
  const acces = await lireAcces();
  if (acces) return acces;
  if (!(await utilisateurConnecte())) redirect("/connexion");
  notFound();
}

// Admins seulement.
export async function exigerAdmin(): Promise<AccesAdmin> {
  const acces = await exigerAcces();
  if (!acces.admin) notFound();
  return acces;
}
