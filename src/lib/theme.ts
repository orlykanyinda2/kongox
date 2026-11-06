// Gestion du mode clair / sombre.
// Le choix est gardé dans localStorage. Au premier lancement, on suit prefers-color-scheme.

export const CLE_THEME = "kongox-theme";

export type Theme = "clair" | "sombre";

// Petit script exécuté dans <head>, avant l'affichage de la page.
export const scriptTheme = `(function(){try{var t=localStorage.getItem("${CLE_THEME}");var s=t?t==="sombre":window.matchMedia("(prefers-color-scheme: dark)").matches;if(s)document.documentElement.classList.add("dark");}catch(e){}})();`;

export function appliquerTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "sombre");
  try {
    localStorage.setItem(CLE_THEME, theme);
  } catch {
    // localStorage indisponible (navigation privée) : on garde le choix pour cette visite seulement
  }
}

export function themeActuel(): Theme {
  return document.documentElement.classList.contains("dark") ? "sombre" : "clair";
}
