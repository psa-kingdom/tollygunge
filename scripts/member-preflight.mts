import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
const pool=new Pool(databaseOptions());
try {
  const identity=(await pool.query("SELECT current_database() AS name")).rows[0].name;
  if(identity!==process.env.TPA_DATABASE_NAME) throw Error("Database identity mismatch.");
  // Report identifiers and counts only. Do not print email/contact values.
  const duplicates=(await pool.query('SELECT array_agg(id ORDER BY id) AS account_ids,count(*)::int AS count FROM public."user" GROUP BY lower(btrim(email)) HAVING count(*)>1')).rows;
  const legacy=(await pool.query("SELECT category,count(*)::int AS count FROM tpa.application_drafts GROUP BY category")).rows;
  const people=(await pool.query("SELECT count(*)::int AS count FROM tpa.people")).rows[0].count;
  console.log(JSON.stringify({database:identity,people,accountEmailCollisions:duplicates,legacyApplications:legacy,migrationReady:!duplicates.length},null,2));
  if(duplicates.length) process.exitCode=1;
} finally {await pool.end();}
