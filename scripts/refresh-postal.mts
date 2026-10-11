import { readFile,writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { parseCsv } from "../src/domain/onboarding-import";
const args=process.argv.slice(2),arg=(key:string)=>args[args.indexOf(key)+1];
for(const key of ["--file","--version","--source","--sha256"]) if(!args.includes(key)) throw Error("Required: --file CSV --version NEW_VERSION --source OFFICIAL_URL --sha256 EXPECTED_HASH");
const version=arg("--version"),source=arg("--source");
if(!/^[a-z0-9-]{1,80}$/.test(version) || !/^https:\/\/(?:[a-z0-9-]+\.)?(?:data\.gov\.in|indiapost\.gov\.in)\//.test(source)) throw Error("Use a new safe version and an official postal source URL.");
const bytes=await readFile(arg("--file")),hash=createHash("sha256").update(bytes).digest("hex");
if(bytes.length>64*1024*1024 || hash!==arg("--sha256").toLowerCase()) throw Error("Source is oversized or does not match the reviewed SHA256.");
const lines=bytes.toString("utf8").replace(/^\uFEFF/,"").split(/\r?\n/),headers=parseCsv(lines.shift()!)[0];
const positions=["StateName","District","OfficeName","Pincode"].map(k=>headers.indexOf(k));
if(positions.some(i=>i<0)) throw Error("Expected the Department of Posts CSV headings.");
const unique=new Map<string,[string,string,string,string]>();
for(const line of lines) {
  if(!line.trim()) continue;
  const row=parseCsv(line)[0];
  const value=positions.map(i=>row[i]?.trim()??"");
  const [state,district,office,pin]=value;
  if(!state || !district || !office || !/^[1-9]\d{5}$/.test(pin)) throw Error("Invalid source row. Do not publish a partial reference.");
  const locality=office.replace(/\s+(?:B\.O|S\.O|H\.O)$/i,"").trim();
  const tuple:[string,string,string,string]=[state,district,locality,pin];unique.set(JSON.stringify(tuple),tuple);
}
const tuples=[...unique.values()].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
if(tuples.length<100000 || new Set(tuples.map(r=>r[0])).size<30) throw Error("Reference appears incomplete; existing data was not replaced.");
const compressed=gzipSync(JSON.stringify(tuples));
await writeFile(`data/postal/${version}.json.gz`,compressed,{flag:"wx"});
await writeFile(`data/postal/${version}.provenance.json`,JSON.stringify({version,publisher:"Department of Posts, Government of India",source,sourceSha256:hash,artifactSha256:createHash("sha256").update(compressed).digest("hex"),retrieved:new Date().toISOString().slice(0,10),license:"Government Open Data License - India",records:tuples.length,limitations:"Postal locality names are not city boundaries. No coordinates retained."},null,2),{flag:"wx"});
console.log(JSON.stringify({version,records:tuples.length,sourceSha256:hash}));
