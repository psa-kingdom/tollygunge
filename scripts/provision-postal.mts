import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
import { parseCsv } from "../src/domain/onboarding-import";
const args=process.argv.slice(2);
const option=(name:string)=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const provenance=JSON.parse(await readFile(option("--provenance")??"data/postal/provenance.json","utf8"));
const bytes=await readFile(option("--file")??`data/postal/${provenance.version}.json.gz`);
const rows=JSON.parse(gunzipSync(bytes).toString("utf8")) as [string,string,string,string][];
const locations=rows.map(([state,district,locality,pin])=>({state:state.trim(),district:district.trim(),locality:locality.trim(),pin:String(pin)}));
if(!locations.length || locations.some(r=>!r.state || !r.district || !r.locality || !/^[1-9]\d{5}$/.test(r.pin))) throw Error("Invalid postal dataset; active reference was not replaced.");
const sourceSha=createHash("sha256").update(bytes).digest("hex");
if(provenance.artifactSha256 && provenance.artifactSha256!==sourceSha) throw Error("Postal artifact checksum differs from provenance.");
const aliasFile=option("--aliases") ?? (provenance.version==="india-post-2026-10-10" ? "data/postal/city-aliases.csv" : undefined);
const aliases=aliasFile ? parseCsv(await readFile(aliasFile,"utf8")) : [];
if(aliases.length && aliases[0].join(",")!=="state,district,alias,city") throw Error("City aliases require state,district,alias,city headings.");
const pool=new Pool(databaseOptions()),c=await pool.connect();
try {
  if((await c.query("SELECT current_database() AS name")).rows[0].name!==process.env.TPA_DATABASE_NAME) throw Error("Database identity mismatch.");
  await c.query("BEGIN");
  await c.query("SELECT pg_advisory_xact_lock(894212037)");
  const previous=(await c.query("SELECT * FROM tpa.postal_versions WHERE id=$1",[provenance.version])).rows[0];
  if(previous && previous.source_sha256!==sourceSha) throw Error("Version content changed; use a new provenance version.");
  await c.query("INSERT INTO tpa.postal_versions(id,source_url,source_sha256) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[provenance.version,provenance.source,sourceSha]);
  for(let start=0;start<locations.length;start+=2000) await c.query("INSERT INTO tpa.postal_locations(version_id,pin,state,district,locality) SELECT $1,pin,state,district,locality FROM jsonb_to_recordset($2::jsonb) AS r(pin text,state text,district text,locality text) ON CONFLICT DO NOTHING",[provenance.version,JSON.stringify(locations.slice(start,start+2000))]);
  for(const [state,district,alias,city] of aliases.slice(1)) {
    if(![state,district,alias,city].every(v=>v?.trim()) || !(await c.query("SELECT 1 FROM tpa.postal_locations WHERE version_id=$1 AND state=$2 AND district=$3 LIMIT 1",[provenance.version,state,district])).rowCount) throw Error("Alias references an unknown hierarchy.");
    const existing=(await c.query("SELECT city FROM tpa.postal_city_aliases WHERE version_id=$1 AND state=$2 AND district=$3 AND lower(alias)=lower($4)",[provenance.version,state,district,alias])).rows[0];
    if(existing && existing.city!==city) throw Error("Conflicting city alias; use a reviewed new dataset version.");
    await c.query("INSERT INTO tpa.postal_city_aliases(version_id,state,district,alias,city) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",[provenance.version,state,district,alias.toLowerCase(),city]);
  }
  await c.query("UPDATE tpa.postal_versions SET active=false WHERE active AND id<>$1",[provenance.version]);
  await c.query("UPDATE tpa.postal_versions SET active=true WHERE id=$1",[provenance.version]);
  await c.query("COMMIT");
  console.log(JSON.stringify({version:provenance.version,locations:locations.length,aliases:Math.max(0,aliases.length-1),artifactSha256:sourceSha}));
} catch(e) {await c.query("ROLLBACK");throw e;} finally {c.release();await pool.end();}
