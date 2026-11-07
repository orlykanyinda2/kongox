// Usage : node sql.cjs fichier.sql  (ou -e "requête")
const { Client } = require("pg");
const fs = require("fs");
(async () => {
  const sql = process.argv[2] === "-e" ? process.argv[3] : fs.readFileSync(process.argv[2], "utf8");
  const c = new Client({ connectionString: process.env.KX_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const r = await c.query(sql);
    const res = Array.isArray(r) ? r : [r];
    for (const x of res) if (x.rows && x.rows.length) console.log(JSON.stringify(x.rows, null, 0));
    console.log("OK");
  } catch (e) { console.error("ERREUR :", e.message, e.hint || "", e.position || ""); process.exitCode = 1; }
  finally { await c.end(); }
})();
