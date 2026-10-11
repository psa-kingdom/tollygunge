import {Pool} from "pg";
import {randomUUID} from "node:crypto";
import {spawn} from "node:child_process";
import assert from "node:assert/strict";
import {databaseOptions} from "../src/lib/database-options";
const name="tpa_onboarding_test_fresh_"+randomUUID().replaceAll("-","");
const root=new Pool(databaseOptions()),url=new URL(process.env.DATABASE_URL!);url.pathname="/"+name;
const env={...process.env,DATABASE_URL:url.toString(),TPA_DATABASE_NAME:name};
try {
  await root.query(`CREATE DATABASE ${name}`);
  for(let n=0;n<2;n++) {
    const code=await new Promise<number>((resolve,reject)=>{const child=spawn(process.execPath,["scripts/migrate.mjs"],{env,stdio:"inherit"});child.on("error",reject);child.on("exit",code=>resolve(code??1));});
    assert.equal(code,0);
  }
  const db=new Pool(databaseOptions(env));
  try {
    assert.equal((await db.query("SELECT count(*)::int n FROM tpa.memberships")).rows[0].n,0);
    assert.equal((await db.query("SELECT count(*)::int n FROM tpa.people")).rows[0].n,0);
    assert.equal((await db.query("SELECT count(*)::int n FROM tpa.postal_versions")).rows[0].n,0);
    console.log("PASS: fresh migrations through latest version, repeat execution, empty member/postal records");
  } finally {await db.end();}
} finally {await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await root.end();}
