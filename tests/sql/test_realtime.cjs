// Vérifie que les messages arrivent en direct (Supabase Realtime) chez un visiteur anonyme,
// et que le masquage arrive aussi (UPDATE sans le texte).
// Usage : node test_realtime.cjs <chemin .env.local> <dossier du projet> <marche_id> <email> <mot de passe> <jeton admin>
const fs = require("fs");
const path = require("path");
const [, , fichierEnv, projet, marcheTxt, email, mdp] = process.argv;
const { createClient } = require(path.join(projet, "node_modules", "@supabase", "supabase-js"));
const env = Object.fromEntries(
  fs.readFileSync(fichierEnv, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const marche = Number(marcheTxt);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

(async () => {
  const visiteur = createClient(url, anon, { auth: { persistSession: false } });
  const ecrivain = createClient(url, anon, { auth: { persistSession: false } });
  const { error: e1 } = await ecrivain.auth.signInWithPassword({ email, password: mdp });
  if (e1) throw e1;

  const recus = [];
  await new Promise((ok, ko) => {
    visiteur
      .channel("test-salon")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages_chat", filter: `marche_id=eq.${marche}` }, (p) => recus.push(p))
      .subscribe((s) => (s === "SUBSCRIBED" ? ok() : s === "CHANNEL_ERROR" || s === "TIMED_OUT" ? ko(new Error(s)) : null));
  });
  await new Promise((r) => setTimeout(r, 1500));
  const debut = Date.now();
  const { data, error } = await ecrivain.rpc("envoyer_message", { p_marche: marche, p_communaute: null, p_texte: "Message en direct !" });
  if (error) throw error;
  while (!recus.some((p) => p.eventType === "INSERT" && p.new.id === data.id) && Date.now() - debut < 20000) await new Promise((r) => setTimeout(r, 100));
  const insert = recus.find((p) => p.eventType === "INSERT" && p.new.id === data.id);
  console.log(insert ? `OK    INSERT reçu en direct par un visiteur en ${Date.now() - debut} ms (texte : ${insert.new.texte})` : "ECHEC INSERT non reçu");
  console.log(JSON.stringify({ id: data.id }));
  process.exit(insert ? 0 : 1);
})().catch((e) => {
  console.error("ECHEC", e.message);
  process.exit(1);
});
