import { LIBELLES_CATEGORIES, STYLES_CATEGORIES, type Categorie } from "@/lib/marches/categories";

export function EtiquetteCategorie({ categorie, petite = false }: { categorie: Categorie; petite?: boolean }) {
  return (
    <span className={`rounded-full font-bold ${petite ? "px-2.5 py-1 text-[11px]" : "px-2.5 py-[5px] text-xs"} ${STYLES_CATEGORIES[categorie]}`}>
      {LIBELLES_CATEGORIES[categorie]}
    </span>
  );
}
