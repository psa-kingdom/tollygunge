import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,copyFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {spawn} from 'node:child_process';
test('import-worker failure restarts independently and cannot stop web login or receive mail keys',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'tpa-import-runtime-'));
 await copyFile(resolve('scripts/start-runtime.mjs'),join(folder,'start-runtime.mjs'));
 await writeFile(join(folder,'server.js'),"const fs=require('fs');fs.writeFileSync('web-ready','ready');setInterval(()=>fs.writeFileSync('web-ready','ready'),100);process.on('SIGTERM',()=>process.exit(0));");
 await writeFile(join(folder,'email-worker.mjs'),"setInterval(()=>{},100);process.on('SIGTERM',()=>process.exit(0));");
 await writeFile(join(folder,'member-import-worker.mjs'),"import fs from 'node:fs';fs.appendFileSync('import-attempts',JSON.stringify({mail:!!process.env.RESEND_API_KEY,receiving:!!process.env.RESEND_RECEIVING_API_KEY,smtp:!!process.env.SMTP_PASSWORD})+'\\n');process.exit(1);");
 const parent=spawn(process.execPath,['start-runtime.mjs'],{cwd:folder,env:{...process.env,RESEND_API_KEY:'synthetic',RESEND_RECEIVING_API_KEY:'synthetic',SMTP_PASSWORD:'synthetic'},stdio:'ignore'});
 try{let attempts:string[]=[];for(let n=0;n<70;n++){try{attempts=(await readFile(join(folder,'import-attempts'),'utf8')).trim().split('\n');}catch{}if(attempts.length>=2)break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.ok(attempts.length>=2,'Importer should restart after failure');assert.equal(parent.exitCode,null);assert.equal(await readFile(join(folder,'web-ready'),'utf8'),'ready');
  for(const attempt of attempts)assert.deepEqual(JSON.parse(attempt),{mail:false,receiving:false,smtp:false});
 }finally{parent.kill('SIGTERM');await new Promise(resolve=>parent.once('exit',resolve));assert.equal(dirname(folder),resolve(tmpdir()));assert.ok(basename(folder).startsWith('tpa-import-runtime-'));await rm(folder,{recursive:true,force:true});}
});
