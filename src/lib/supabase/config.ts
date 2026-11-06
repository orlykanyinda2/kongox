// Lecture des variables publiques Supabase (définies dans .env.local).

export function configSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cleAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, cleAnon, prete: Boolean(url && cleAnon) };
}

export function configSupabaseObligatoire() {
  const { url, cleAnon } = configSupabase();
  if (!url || !cleAnon) {
    throw new Error(
      "Supabase n'est pas configuré : remplis NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local."
    );
  }
  return { url, cleAnon };
}
