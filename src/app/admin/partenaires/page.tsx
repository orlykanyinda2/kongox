import { Suspense } from "react";
import { EnTetePage, Pastille, cls } from "@/components/admin/ui";
import { ChampFiltre, Filtres, Tableau, type Colonne } from "@/components/admin/Tableau";
import { ActionConfirmee, BoutonAction } from "@/components/admin/Actions";
import { changerStatutDemande, noterDemande } from "@/app/actions/demandes";
import { exigerAdmin } from "@/lib/admin/acces";
import { lirePage, valeur, type Params } from "@/lib/admin/tableau";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { TYPES_PARTENARIAT } from "@/lib/partenaires";
import { formaterDate } from "@/lib/format";

// Demandes envoyées depuis la page « Devenir partenaire de KongoX »
export default function PagePartenaires({ searchParams }: PageProps<"/admin/partenaires">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Demandes searchParams={searchParams} />
    </Suspense>
  );
}

type Demande = {
  id: number;
  nom: string;
  organisation: string | null;
  type: keyof typeof TYPES_PARTENARIAT;
  contact: string;
  message: string;
  statut: string;
  note: string | null;
  cree_le: string;
};

const STATUTS: Record<string, { libelle: string; ton: "attention" | "accent" | "neutre" }> = {
  nouvelle: { libelle: "Nouvelle", ton: "attention" },
  en_cours: { libelle: "En cours", ton: "accent" },
  traitee: { libelle: "Traitée", ton: "neutre" },
  archivee: { libelle: "Archivée", ton: "neutre" },
};

// Lien direct pour répondre : WhatsApp pour un numéro, e-mail sinon
function lienContact(contact: string) {
  if (contact.includes("@")) return `mailto:${contact}`;
  return `https://wa.me/${contact.replace(/[^0-9]/g, "")}`;
}

async function Demandes({ searchParams }: { searchParams: Promise<Params> }) {
  await exigerAdmin();
  const params = await searchParams;
  const { page, debut, fin } = lirePage(params);
  const statut = valeur(params, "statut") || "a_traiter";

  const supabase = await creerClientServeur();
  let requete = supabase.from("demandes_partenaires").select("id, nom, organisation, type, contact, message, statut, note, cree_le", { count: "exact" });
  if (statut === "a_traiter") requete = requete.in("statut", ["nouvelle", "en_cours"]);
  else if (statut !== "toutes") requete = requete.eq("statut", statut);
  const { data, count } = await requete.order("cree_le", { ascending: false }).range(debut, fin).returns<Demande[]>();

  const colonnes: Colonne<Demande>[] = [
    { cle: "date", titre: "Reçue le", rendu: (d) => formaterDate(d.cree_le) },
    {
      cle: "qui",
      titre: "De",
      rendu: (d) => (
        <span className="flex flex-col">
          <span className="font-medium">{d.nom}</span>
          {d.organisation && <span className="text-xs text-adm-secondaire">{d.organisation}</span>}
          <a href={lienContact(d.contact)} target="_blank" rel="noopener noreferrer" className="text-xs text-adm-accent hover:underline">
            {d.contact}
          </a>
        </span>
      ),
    },
    { cle: "type", titre: "Type", rendu: (d) => TYPES_PARTENARIAT[d.type] ?? d.type },
    {
      cle: "message",
      titre: "Message",
      rendu: (d) => (
        <span className="block max-w-[420px] whitespace-pre-line text-[13px]">
          {d.message}
          {d.note && <span className="mt-1 block text-xs text-adm-secondaire">Note : {d.note}</span>}
        </span>
      ),
    },
    { cle: "statut", titre: "Statut", rendu: (d) => <Pastille ton={STATUTS[d.statut]?.ton}>{STATUTS[d.statut]?.libelle}</Pastille> },
    {
      cle: "actions",
      titre: "",
      rendu: (d) => (
        <span className="flex flex-wrap gap-1.5">
          {d.statut === "nouvelle" && <BoutonAction action={changerStatutDemande.bind(null, d.id, "en_cours")} libelle="Prendre en charge" variante="principal" />}
          {d.statut !== "traitee" && d.statut !== "archivee" && <BoutonAction action={changerStatutDemande.bind(null, d.id, "traitee")} libelle="Traitée" />}
          {d.statut !== "archivee" && <BoutonAction action={changerStatutDemande.bind(null, d.id, "archivee")} libelle="Archiver" />}
          <ActionConfirmee
            action={noterDemande.bind(null, d.id, d.statut)}
            libelle="Note"
            titre="Note interne"
            message="Visible seulement par l'équipe (ex. « Rendez-vous lundi », « Devis envoyé »)."
            confirmer="Enregistrer"
            variante="secondaire"
            danger={false}
            champs={[{ nom: "note", libelle: "Note", type: "zone", requis: true }]}
          />
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre="Partenaires" description="Demandes reçues par la page « Devenir partenaire de KongoX ». Réponds sur WhatsApp ou par e-mail (lien sur le contact)." />
      <Filtres chemin="/admin/partenaires">
        <ChampFiltre libelle="Statut">
          <select name="statut" defaultValue={statut} className={cls.champ}>
            <option value="a_traiter">À traiter</option>
            <option value="nouvelle">Nouvelles</option>
            <option value="en_cours">En cours</option>
            <option value="traitee">Traitées</option>
            <option value="archivee">Archivées</option>
            <option value="toutes">Toutes</option>
          </select>
        </ChampFiltre>
      </Filtres>
      <Tableau
        chemin="/admin/partenaires"
        params={params}
        colonnes={colonnes}
        lignes={data ?? []}
        cle={(d) => d.id}
        total={count ?? 0}
        page={page}
        tri="cree_le"
        croissant={false}
        vide="Aucune demande."
      />
    </div>
  );
}
