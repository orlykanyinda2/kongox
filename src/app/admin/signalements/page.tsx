import { Suspense } from "react";
import Link from "next/link";
import { EnTetePage, Section } from "@/components/admin/ui";
import { ActionConfirmee, BoutonAction } from "@/components/admin/Actions";
import { FormulaireMot } from "@/components/admin/FormulaireMot";
import { bloquerChat, masquerMessage, retablirMessage, retirerMotInterdit, traiterSignalement } from "@/app/actions/moderation";
import { retirerPhoto } from "@/app/actions/communauteAdmin";
import { Avatar } from "@/components/profil/Avatar";
import { exigerAdmin } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterDate } from "@/lib/format";

// Modération du chat : signalements ouverts (messages et marchés), messages masqués, mots interdits.
export default function PageSignalements({ searchParams }: PageProps<"/admin/signalements">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Signalements searchParams={searchParams} />
    </Suspense>
  );
}

const VUES = { ouverts: "Signalements ouverts", masques: "Messages masqués", mots: "Mots interdits" } as const;
type Vue = keyof typeof VUES;

const MOTIFS: Record<string, string> = {
  insulte: "Insulte ou harcèlement",
  arnaque: "Arnaque ou argent réel",
  spam: "Pub ou spam",
  ligne_rouge: "Ligne rouge",
  photo: "Photo inappropriée",
  autre: "Autre",
};

type Message = {
  id: number;
  marche_id: number | null;
  communaute_id: number | null;
  auteur_id: string;
  auteur_nom: string;
  texte: string | null;
  masque: boolean;
  cree_le: string;
  communaute: { nom: string } | null;
  marche: { question: string } | null;
  original: { texte: string; motif: string } | null;
};

type Ligne = {
  id: number;
  motif: string;
  detail: string | null;
  cree_le: string;
  message_id: number | null;
  marche_id: number | null;
  signaleur: { nom_utilisateur: string } | null;
  message: Message | null;
  marche: { id: number; question: string; statut: string } | null;
  utilisateur_cible: string | null;
  cible: { nom_utilisateur: string; photo: string | null; icone: string | null } | null;
};

const CHAMPS_MESSAGE =
  "id, marche_id, communaute_id, auteur_id, auteur_nom, texte, masque, cree_le, " +
  "communaute:communautes!messages_chat_communaute_id_fkey(nom), marche:marches!messages_chat_marche_id_fkey(question), " +
  "original:messages_masques!messages_masques_message_id_fkey(texte, motif)";

function lienSalon(m: Message) {
  return m.marche_id ? `/marches/${m.marche_id}#chat` : `/communautes/${m.communaute_id}#chat`;
}

function nomSalon(m: Message) {
  return m.marche ? `Marché : ${m.marche.question}` : `Communauté : ${m.communaute?.nom ?? "?"}`;
}

async function Signalements({ searchParams }: { searchParams: PageProps<"/admin/signalements">["searchParams"] }) {
  await exigerAdmin();
  const p = await searchParams;
  const vue: Vue = (typeof p.vue === "string" && p.vue in VUES ? p.vue : "ouverts") as Vue;

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre="Signalements"
        description="Messages et marchés signalés par les utilisateurs. Un message signalé par plusieurs personnes est masqué automatiquement (réglage chat_signalements_masquage) en attendant ta décision."
      />
      <nav aria-label="Vues" className="flex flex-wrap gap-1 border-b border-adm-bordure">
        {(Object.keys(VUES) as Vue[]).map((v) => (
          <Link
            key={v}
            href={`/admin/signalements?vue=${v}`}
            aria-current={v === vue ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${v === vue ? "border-adm-accent text-adm-texte" : "border-transparent text-adm-secondaire hover:text-adm-texte"}`}
          >
            {VUES[v]}
          </Link>
        ))}
      </nav>
      {vue === "ouverts" ? <Ouverts /> : vue === "masques" ? <Masques /> : <Mots />}
    </div>
  );
}

// Un message (texte, auteur, salon) et les actions de modération
function CarteMessage({ m, actions }: { m: Message; actions?: React.ReactNode }) {
  const texte = m.masque ? m.original?.texte : m.texte;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-adm-secondaire">
        <Link href={`/admin/utilisateurs/${m.auteur_id}`} className="font-semibold text-adm-texte underline">
          @{m.auteur_nom}
        </Link>
        <span>{formaterDate(m.cree_le)}</span>
        <Link href={lienSalon(m)} className="underline" target="_blank">
          {nomSalon(m)}
        </Link>
        {m.masque && <span className="rounded bg-[#fbeeee] px-1.5 py-0.5 text-xs font-semibold text-adm-danger">Masqué ({m.original?.motif === "signalements" ? "automatiquement" : m.original?.motif})</span>}
      </div>
      <p className="whitespace-pre-line rounded-md border border-adm-bordure bg-adm-zone px-3 py-2 text-sm">{texte ?? "—"}</p>
      {actions}
    </div>
  );
}

function ActionsAuteur({ auteur }: { auteur: string }) {
  return (
    <>
      <BoutonAction action={bloquerChat.bind(null, auteur, 24)} libelle="Bloquer du chat 24 h" />
      <BoutonAction action={bloquerChat.bind(null, auteur, 24 * 7)} libelle="Bloquer 7 jours" />
    </>
  );
}

async function Ouverts() {
  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("signalements")
    .select(
      `id, motif, detail, cree_le, message_id, marche_id, signaleur:utilisateurs!signalements_auteur_id_fkey(nom_utilisateur), ` +
        `message:messages_chat!signalements_message_id_fkey(${CHAMPS_MESSAGE}), marche:marches!signalements_marche_id_fkey(id, question, statut), ` +
        `utilisateur_cible, cible:utilisateurs!signalements_utilisateur_cible_fkey(nom_utilisateur, photo, icone)`,
    )
    .eq("statut", "ouvert")
    .order("cree_le", { ascending: false })
    .limit(300)
    .returns<Ligne[]>();

  // Un bloc par cible (message ou marché), avec tous ses signalements
  const groupes = new Map<string, Ligne[]>();
  for (const l of data ?? []) {
    const cle = l.message_id ? `m${l.message_id}` : l.marche_id ? `q${l.marche_id}` : `p${l.utilisateur_cible}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), l]);
  }

  if (groupes.size === 0) {
    return (
      <Section>
        <p className="text-sm text-adm-secondaire">Aucun signalement ouvert. Tout est calme.</p>
      </Section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {[...groupes.values()].map((g) => {
        const premier = g[0];
        const resume = (
          <p className="text-xs text-adm-secondaire">
            {g.length} signalement{g.length > 1 ? "s" : ""} :{" "}
            {g.map((s) => `${MOTIFS[s.motif] ?? s.motif} (@${s.signaleur?.nom_utilisateur ?? "?"}${s.detail ? ` : « ${s.detail} »` : ""})`).join(" · ")}
          </p>
        );
        return (
          <Section key={premier.id} titre={premier.message ? "Message signalé" : premier.marche_id ? "Marché signalé" : "Photo de profil signalée"}>
            {premier.utilisateur_cible ? (
              <div className="flex flex-wrap items-start gap-4">
                {premier.cible?.photo ? (
                  <Avatar nom={premier.cible.nom_utilisateur} icone={null} photo={premier.cible.photo} taille={120} className="rounded-lg" />
                ) : (
                  <p className="text-sm text-adm-secondaire">La photo a déjà été retirée.</p>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Link href={`/admin/utilisateurs/${premier.utilisateur_cible}`} className="text-sm font-semibold text-adm-texte underline">
                    @{premier.cible?.nom_utilisateur}
                  </Link>
                  {resume}
                  <div className="flex flex-wrap gap-2">
                    {premier.cible?.photo && (
                      <ActionConfirmee
                        action={retirerPhoto.bind(null, premier.utilisateur_cible)}
                        libelle="Retirer la photo"
                        titre="Retirer cette photo ?"
                        message="Le fichier est effacé et l'icône de la personne revient. Elle pourra envoyer une autre photo."
                        confirmer="Retirer"
                        champs={[{ nom: "motif", libelle: "Motif (journal)", type: "texte" }]}
                      />
                    )}
                    <BoutonAction action={traiterSignalement.bind(null, premier.id, premier.cible?.photo ? "rejete" : "traite")} libelle={premier.cible?.photo ? "Rejeter (photo correcte)" : "Clore"} />
                    <ActionsAuteur auteur={premier.utilisateur_cible} />
                  </div>
                </div>
              </div>
            ) : premier.message ? (
              <CarteMessage
                m={premier.message}
                actions={
                  <>
                    {resume}
                    <div className="flex flex-wrap gap-2">
                      {!premier.message.masque && (
                        <ActionConfirmee
                          action={masquerMessage.bind(null, premier.message.id)}
                          libelle="Masquer le message"
                          titre="Masquer ce message ?"
                          message="Le texte disparaît du salon pour tout le monde. Tu pourras le rétablir dans « Messages masqués »."
                          confirmer="Masquer"
                          champs={[{ nom: "motif", libelle: "Motif (journal)", type: "texte" }]}
                        />
                      )}
                      {premier.message.masque ? (
                        <>
                          <BoutonAction action={traiterSignalement.bind(null, premier.id, "traite")} libelle="Garder masqué" variante="principal" />
                          <BoutonAction action={retablirMessage.bind(null, premier.message.id)} libelle="Rétablir le message" />
                        </>
                      ) : (
                        <BoutonAction action={traiterSignalement.bind(null, premier.id, "rejete")} libelle="Rejeter (rien à faire)" />
                      )}
                      <ActionsAuteur auteur={premier.message.auteur_id} />
                    </div>
                  </>
                }
              />
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{premier.marche?.question ?? "Marché introuvable"}</p>
                {resume}
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/marches/${premier.marche_id}`} className="inline-flex h-9 items-center rounded-md border border-adm-bordure bg-white px-3.5 text-sm font-semibold">
                    Ouvrir le marché
                  </Link>
                  <BoutonAction action={traiterSignalement.bind(null, premier.id, "traite")} libelle="Traité" variante="principal" />
                  <BoutonAction action={traiterSignalement.bind(null, premier.id, "rejete")} libelle="Rejeter" />
                </div>
              </div>
            )}
          </Section>
        );
      })}
    </div>
  );
}

async function Masques() {
  const supabase = await creerClientServeur();
  const { data } = await supabase.from("messages_chat").select(CHAMPS_MESSAGE).eq("masque", true).order("id", { ascending: false }).limit(100).returns<Message[]>();
  return (
    <div className="flex flex-col gap-3">
      {(data ?? []).length === 0 && (
        <Section>
          <p className="text-sm text-adm-secondaire">Aucun message masqué.</p>
        </Section>
      )}
      {(data ?? []).map((m) => (
        <Section key={m.id}>
          <CarteMessage
            m={m}
            actions={
              <div className="flex flex-wrap gap-2">
                <BoutonAction action={retablirMessage.bind(null, m.id)} libelle="Rétablir le message" />
                <ActionsAuteur auteur={m.auteur_id} />
                <BoutonAction action={bloquerChat.bind(null, m.auteur_id, 0)} libelle="Débloquer l'auteur" />
              </div>
            }
          />
        </Section>
      ))}
    </div>
  );
}

async function Mots() {
  const supabase = await creerClientServeur();
  const { data } = await supabase.from("mots_interdits").select("id, mot, cree_le").order("mot").returns<{ id: number; mot: string; cree_le: string }[]>();
  return (
    <Section titre={`Mots interdits (${(data ?? []).length})`}>
      <p className="mb-3 text-[13px] text-adm-secondaire">
        Un mot interdit est remplacé par des étoiles dans les messages. La comparaison se fait sans accents ni majuscules, sur le mot entier (« connard » ne touche pas « connardise »). Les liens sont toujours retirés. Ajoute aussi les insultes en lingala et en swahili.
      </p>
      <FormulaireMot />
      <ul className="mt-4 flex flex-wrap gap-2">
        {(data ?? []).map((m) => (
          <li key={m.id} className="flex items-center gap-2 rounded-md border border-adm-bordure bg-adm-zone py-1 pl-2.5 pr-1 text-sm">
            {m.mot}
            <BoutonAction action={retirerMotInterdit.bind(null, m.id)} libelle="Retirer" />
          </li>
        ))}
      </ul>
    </Section>
  );
}
