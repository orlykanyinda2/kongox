import { type NextRequest } from "next/server";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { motifRecherche } from "@/lib/admin/tableau";
import { libelleAction } from "@/lib/admin/libelles";
import { idParNomPublic } from "@/lib/admin/requetes";

// Export CSV des tableaux admin (mêmes filtres que l'écran). Séparateur « ; » et BOM pour Excel.
const MAX_LIGNES = 10000;

function csv(entetes: string[], lignes: (string | number | null | undefined)[][]) {
  const cellule = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [entetes, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n");
}

const date = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Kinshasa", dateStyle: "short", timeStyle: "short" }).format(new Date(iso)) : "";

export async function GET(requete: NextRequest, { params }: RouteContext<"/admin/export/[type]">) {
  const { type } = await params;
  const supabase = await creerClientServeur();
  const { data: admin } = await supabase.rpc("est_admin");
  if (admin !== true) return new Response("Accès refusé.", { status: 403 });
  const p = requete.nextUrl.searchParams;
  const q = (p.get("q") ?? "").trim().replace(/^@/, "");

  let contenu: string;
  if (type === "marches") {
    let r = supabase
      .from("marches")
      .select("id, question, categorie, statut, source, date_publication, date_fin, soki_du_jour, mis_en_avant, options:options_marche!options_marche_marche_id_fkey(libelle, total_mise)");
    if (q) r = /^\d+$/.test(q) ? r.eq("id", Number(q)) : r.ilike("question", motifRecherche(q));
    if (p.get("statut")) r = r.eq("statut", p.get("statut")!);
    if (p.get("categorie")) r = r.eq("categorie", p.get("categorie")!);
    const { data } = await r.order("id", { ascending: false }).limit(MAX_LIGNES);
    contenu = csv(
      ["n°", "question", "catégorie", "statut", "source", "publication", "fermeture", "soki du jour", "mis en avant", "pièces OUI", "pièces NON"],
      (data ?? []).map((m) => {
        const o = m.options as { libelle: string; total_mise: number }[];
        return [m.id, m.question, m.categorie, m.statut, m.source, date(m.date_publication), date(m.date_fin), m.soki_du_jour ? "oui" : "", m.mis_en_avant ? "oui" : "",
          o.find((x) => x.libelle === "OUI")?.total_mise, o.find((x) => x.libelle === "NON")?.total_mise];
      }),
    );
  } else if (type === "utilisateurs") {
    let r = supabase.from("utilisateurs").select("nom_utilisateur, role, solde_pieces, serie_jours, dernier_bonus_le, cree_le");
    if (q) r = r.ilike("nom_utilisateur", motifRecherche(q));
    if (p.get("role")) r = r.eq("role", p.get("role")!);
    const { data } = await r.order("cree_le", { ascending: false }).limit(MAX_LIGNES);
    contenu = csv(
      ["nom d'utilisateur", "rôle", "solde", "série (jours)", "dernier bonus", "inscrit le"],
      (data ?? []).map((u) => [u.nom_utilisateur, u.role, u.solde_pieces, u.serie_jours, u.dernier_bonus_le, date(u.cree_le)]),
    );
  } else if (type === "ajustements") {
    let r = supabase
      .from("ajustements_pieces")
      .select("cree_le, montant, solde_avant, solde_apres, raison, lot, compte:utilisateurs!ajustements_pieces_utilisateur_id_fkey(nom_utilisateur), auteur:utilisateurs!ajustements_pieces_auteur_id_fkey(nom_utilisateur)");
    if (p.get("sens") === "ajout") r = r.gt("montant", 0);
    if (p.get("sens") === "retrait") r = r.lt("montant", 0);
    if (/^[0-9a-f-]{36}$/.test(p.get("lot") ?? "")) r = r.eq("lot", p.get("lot")!);
    const { data } = await r.order("cree_le", { ascending: false }).limit(MAX_LIGNES);
    contenu = csv(
      ["date", "compte", "montant", "solde avant", "solde après", "raison", "lot (bonus en masse)", "par"],
      (data ?? []).map((a) => {
        const compte = a.compte as unknown as { nom_utilisateur: string } | null;
        const auteur = a.auteur as unknown as { nom_utilisateur: string } | null;
        return [date(a.cree_le), compte?.nom_utilisateur, a.montant, a.solde_avant, a.solde_apres, a.raison, a.lot, auteur?.nom_utilisateur];
      }),
    );
  } else if (type === "journal") {
    let r = supabase
      .from("journal_admin")
      .select("cree_le, action, avant, apres, details, cible_marche, auteur:utilisateurs!journal_admin_auteur_id_fkey(nom_utilisateur), cible:utilisateurs!journal_admin_cible_utilisateur_fkey(nom_utilisateur)");
    if (p.get("action")) r = r.eq("action", p.get("action")!);
    const auteur = (p.get("auteur") ?? "").replace(/^@/, "");
    const utilisateur = (p.get("utilisateur") ?? "").replace(/^@/, "");
    if (auteur) r = r.eq("auteur_id", (await idParNomPublic(auteur)) ?? "00000000-0000-0000-0000-000000000000");
    if (utilisateur) r = r.eq("cible_utilisateur", (await idParNomPublic(utilisateur)) ?? "00000000-0000-0000-0000-000000000000");
    if (/^\d+$/.test(p.get("marche") ?? "")) r = r.eq("cible_marche", Number(p.get("marche")));
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.get("du") ?? "")) r = r.gte("cree_le", `${p.get("du")}T00:00:00+01:00`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.get("au") ?? "")) r = r.lte("cree_le", `${p.get("au")}T23:59:59+01:00`);
    const { data } = await r.order("cree_le", { ascending: false }).limit(MAX_LIGNES);
    contenu = csv(
      ["quand", "qui", "action", "compte visé", "marché n°", "avant", "après", "détails"],
      (data ?? []).map((j) => {
        const a = j.auteur as unknown as { nom_utilisateur: string } | null;
        const c = j.cible as unknown as { nom_utilisateur: string } | null;
        return [date(j.cree_le), a?.nom_utilisateur ?? "système", libelleAction(j.action), c?.nom_utilisateur, j.cible_marche,
          j.avant ? JSON.stringify(j.avant) : "", j.apres ? JSON.stringify(j.apres) : "", j.details ? JSON.stringify(j.details) : ""];
      }),
    );
  } else {
    return new Response("Export inconnu.", { status: 404 });
  }

  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kinshasa" }).format(new Date());
  return new Response(contenu, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kongox-${type}-${jour}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
