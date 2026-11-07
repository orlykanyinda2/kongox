import { Suspense } from "react";
import Link from "next/link";
import { EnTetePage, Pastille, Section, cls } from "@/components/admin/ui";
import { FormulaireAction } from "@/components/admin/FormulaireAction";
import { BadgeIcone, COULEURS_NIVEAU, type Niveau } from "@/components/badges/BadgeIcone";
import { Avatar } from "@/components/profil/Avatar";
import { enregistrerBadge, modifierIcone, offrirBadge, offrirIcone } from "@/app/actions/communauteAdmin";
import { exigerAdmin } from "@/lib/admin/acces";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { formaterNombre } from "@/lib/format";

// Badges (créer, modifier, offrir) et icônes de profil (prix de la boutique, offrir, changer l'icône d'une personne)
export default function PageBadgesIcones({ searchParams }: PageProps<"/admin/badges">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-lg bg-adm-zone" />}>
      <Contenu searchParams={searchParams} />
    </Suspense>
  );
}

type Badge = { code: string; nom: string; description: string; glyphe: string; niveau: Niveau; famille: string; condition: string; seuil: number; actif: boolean };
type Icone = { code: string; nom: string; categorie: string; niveau: string; prix: number; badge_requis: string | null; actif: boolean };

const CONDITIONS: Record<string, string> = {
  predictions: "Nombre de prédictions",
  serie: "Série de jours",
  mayele: "Score Mayele (%)",
  questions_approuvees: "Questions approuvées",
  top10_semaine: "Top 10 de la semaine",
  top10_mois: "Top 10 du mois",
  curateur: "Curateur",
  parrain: "Amis parrainés",
  bavard: "Commentaires",
  fidele: "Invité devenu membre",
  manuel: "Offert à la main",
};
const GLYPHES = ["etoile", "flamme", "cible", "cerveau", "plume", "podium", "couronne", "bouclier", "mains", "bulle", "coeur"];

function ChampsBadge({ b }: { b?: Badge }) {
  return (
    <>
      <label className="w-36">
        <span className={cls.label}>Code</span>
        <input name="code" defaultValue={b?.code} readOnly={!!b} required pattern="[a-z0-9_]{2,40}" className={`${cls.champ} mt-1 ${b ? "bg-adm-zone" : ""}`} />
      </label>
      <label className="w-44">
        <span className={cls.label}>Nom</span>
        <input name="nom" defaultValue={b?.nom} required maxLength={40} className={`${cls.champ} mt-1`} />
      </label>
      <label className="min-w-[220px] flex-1">
        <span className={cls.label}>Description</span>
        <input name="description" defaultValue={b?.description} required maxLength={160} className={`${cls.champ} mt-1`} />
      </label>
      <label className="w-32">
        <span className={cls.label}>Famille</span>
        <input name="famille" defaultValue={b?.famille ?? "Autres"} maxLength={30} className={`${cls.champ} mt-1`} />
      </label>
      <label className="w-28">
        <span className={cls.label}>Niveau</span>
        <select name="niveau" defaultValue={b?.niveau ?? "bronze"} className={`${cls.champ} mt-1`}>
          <option value="bronze">Bronze</option>
          <option value="argent">Argent</option>
          <option value="or">Or</option>
        </select>
      </label>
      <label className="w-28">
        <span className={cls.label}>Dessin</span>
        <select name="glyphe" defaultValue={b?.glyphe ?? "etoile"} className={`${cls.champ} mt-1`}>
          {GLYPHES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>
      <label className="w-48">
        <span className={cls.label}>Condition</span>
        <select name="condition" defaultValue={b?.condition ?? "manuel"} className={`${cls.champ} mt-1`}>
          {Object.entries(CONDITIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="w-20">
        <span className={cls.label}>Seuil</span>
        <input name="seuil" type="number" min={0} defaultValue={b?.seuil ?? 0} className={`${cls.champ} mt-1`} />
      </label>
      <label className="flex h-9 items-center gap-1.5 text-sm">
        <input name="actif" type="checkbox" defaultChecked={b?.actif ?? true} /> Actif
      </label>
    </>
  );
}

async function Contenu({ searchParams }: { searchParams: PageProps<"/admin/badges">["searchParams"] }) {
  await exigerAdmin();
  const { modifier } = await searchParams;
  const supabase = await creerClientServeur();
  const [{ data: badges }, { data: icones }, { data: comptes }] = await Promise.all([
    supabase.from("badges").select("code, nom, description, glyphe, niveau, famille, condition, seuil, actif").order("ordre").returns<Badge[]>(),
    supabase.from("icones").select("code, nom, categorie, niveau, prix, badge_requis, actif").order("ordre").returns<Icone[]>(),
    supabase.from("badges_gagnes").select("badge_code"),
  ]);
  const nombreParBadge = new Map<string, number>();
  for (const g of (comptes ?? []) as { badge_code: string }[]) nombreParBadge.set(g.badge_code, (nombreParBadge.get(g.badge_code) ?? 0) + 1);
  const aModifier = (badges ?? []).find((b) => b.code === modifier);

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre="Badges et icônes"
        description="Les badges se gagnent tout seuls (fonctions SQL après un vote, un règlement, un bonus, une approbation…). Un badge peut débloquer une icône élite. Tout changement est écrit dans le journal."
      />

      <Section titre="Offrir">
        <div className="flex flex-col gap-4">
          <FormulaireAction action={offrirBadge} bouton="Offrir le badge">
            <label className="w-48">
              <span className={cls.label}>Nom d&apos;utilisateur</span>
              <input name="nom" required className={`${cls.champ} mt-1`} />
            </label>
            <label className="w-56">
              <span className={cls.label}>Badge</span>
              <select name="code" className={`${cls.champ} mt-1`}>
                {(badges ?? []).map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.nom} ({COULEURS_NIVEAU[b.niveau]?.libelle})
                  </option>
                ))}
              </select>
            </label>
          </FormulaireAction>
          <FormulaireAction action={offrirIcone} bouton="Valider">
            <label className="w-48">
              <span className={cls.label}>Nom d&apos;utilisateur</span>
              <input name="nom" required className={`${cls.champ} mt-1`} />
            </label>
            <label className="w-56">
              <span className={cls.label}>Icône</span>
              <select name="code" className={`${cls.champ} mt-1`}>
                {(icones ?? []).map((i) => (
                  <option key={i.code} value={i.code}>
                    {i.nom} ({i.niveau})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex h-9 items-center gap-1.5 text-sm">
              <input name="porter" type="checkbox" /> La mettre comme icône (retire sa photo)
            </label>
          </FormulaireAction>
        </div>
      </Section>

      <Section titre={aModifier ? `Modifier « ${aModifier.nom} »` : "Créer un badge"}>
        <FormulaireAction key={aModifier?.code ?? "nouveau"} action={enregistrerBadge} bouton={aModifier ? "Enregistrer" : "Créer"}>
          <ChampsBadge b={aModifier} />
        </FormulaireAction>
        {aModifier && (
          <Link href="/admin/badges" className="mt-2 inline-block text-xs text-adm-accent hover:underline">
            Annuler et créer un nouveau badge
          </Link>
        )}
      </Section>

      <Section titre={`Badges (${(badges ?? []).length})`} className="[&>div:last-child]:p-0">
        <table className="w-full text-sm">
          <tbody>
            {(badges ?? []).map((b) => (
              <tr key={b.code} className="border-b border-adm-bordure last:border-b-0">
                <td className="w-12 px-3 py-2">
                  <BadgeIcone glyphe={b.glyphe} niveau={b.niveau} taille={32} gris={!b.actif} />
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">
                    {b.nom} <span className="text-xs text-adm-secondaire">· {b.code}</span>
                  </div>
                  <div className="text-xs text-adm-secondaire">{b.description}</div>
                </td>
                <td className="px-3 py-2 text-[13px]">
                  {CONDITIONS[b.condition] ?? b.condition}
                  {b.seuil > 0 ? ` ≥ ${b.seuil}` : ""}
                </td>
                <td className="px-3 py-2 text-[13px] tabular-nums">{formaterNombre(nombreParBadge.get(b.code) ?? 0)} gagné(s)</td>
                <td className="px-3 py-2">{b.actif ? <Pastille ton="accent">Actif</Pastille> : <Pastille ton="neutre">Inactif</Pastille>}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/admin/badges?modifier=${b.code}`} className="text-xs font-semibold text-adm-accent hover:underline">
                    Modifier
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section titre={`Icônes (${(icones ?? []).length})`} className="[&>div:last-child]:p-0">
        <table className="w-full text-sm">
          <tbody>
            {(icones ?? []).map((i) => (
              <tr key={i.code} className="border-b border-adm-bordure last:border-b-0">
                <td className="w-14 px-3 py-2">
                  <Avatar nom={null} icone={i.code} photo={null} elite={i.niveau === "elite"} taille={36} />
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{i.nom}</div>
                  <div className="text-xs text-adm-secondaire">
                    {i.categorie} · {i.niveau === "elite" ? `élite (badge ${i.badge_requis ?? "—"})` : i.niveau}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <FormulaireAction action={modifierIcone.bind(null, i.code)} bouton="Enregistrer" className="flex flex-wrap items-center gap-2">
                    {i.niveau === "boutique" && (
                      <label className="flex items-center gap-1.5 text-[13px]">
                        Prix
                        <input name="prix" type="number" min={1} max={1000000} defaultValue={i.prix} className={`${cls.champ} w-24 text-right tabular-nums`} />
                        pièces
                      </label>
                    )}
                    <label className="flex items-center gap-1.5 text-[13px]">
                      <input name="actif" type="checkbox" defaultChecked={i.actif} /> Disponible
                    </label>
                  </FormulaireAction>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
