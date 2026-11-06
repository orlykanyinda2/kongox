import Link from "next/link";

// Logo KongoX : pastille vert-jaune avec le X, puis « Kongo » + « X » dans sa pastille.
export function Logo({ libelle }: { libelle: string }) {
  return (
    <Link href="/" aria-label={libelle} className="inline-flex items-center gap-2.5 text-texte">
      <span className="flex size-10 items-center justify-center rounded-bouton border-2 border-foret bg-vert-jaune shadow-foret">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F3A26" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true">
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </span>
      <span className="font-titre text-[25px] font-bold tracking-[-0.8px]">
        Kongo<span className="ml-0.5 rounded-lg bg-vert-jaune px-1.5 text-foret">X</span>
      </span>
    </Link>
  );
}
