import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createLocalEnvironment} from './setup-local-env.mjs';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ez-local-setup-'));
try{
 assert.equal((await createLocalEnvironment(temp)).status,'created_private_local_configuration');
 const a=path.join(temp,'server','.env'),b=path.join(temp,'.env.local');
 const original=await fs.readFile(a,'utf8');assert.equal((await fs.stat(a)).mode&0o777,0o600);assert.equal((await fs.stat(b)).mode&0o777,0o600);
 const values=Object.fromEntries(original.split('\n').filter(x=>x.includes('=')).map(x=>x.split('=')));
 assert(values.SESSION_SECRET.length>=32&&values.CONSOLE_SESSION_SECRET.length>=32&&values.SESSION_SECRET!==values.CONSOLE_SESSION_SECRET);
 assert.equal((await createLocalEnvironment(temp)).status,'retained_existing_local_configuration');assert.equal(await fs.readFile(a,'utf8'),original);
 await fs.rm(b);await assert.rejects(createLocalEnvironment(temp),/Partial local configuration/);assert.equal(await fs.readFile(a,'utf8'),original);
 const raw=process.env.TEST_DATABASE_URL;if(!raw)throw new Error('TEST_DATABASE_URL required for CLI fixture');
 const u=new URL(raw);assert(['localhost','127.0.0.1'].includes(u.hostname)&&/_test$/.test(u.pathname));
 const {Client}=createRequire(new URL('../server/package.json',import.meta.url))('pg');const admin=new Client({connectionString:raw});await admin.connect();
 const db='ez_local_setup_test';assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[db])).rowCount,0);await admin.query(`CREATE DATABASE ${db}`);
 try{
  u.pathname='/'+db;const envfile=path.join(temp,'cli.env');await fs.writeFile(envfile,`DATABASE_URL=${u.toString()}\n`,{mode:0o600});
  const input=JSON.stringify({email:'operator@example.test',name:'Synthetic local setup',password:randomBytes(24).toString('hex')});
  const childEnv={...process.env};delete childEnv.DATABASE_URL;
  const args=['--env-file='+envfile,'node_modules/tsx/dist/cli.mjs','--tsconfig','server/tsconfig.json','scripts/bootstrap-operator.ts'];
  const first=spawnSync(process.execPath,args,{env:childEnv,input,encoding:'utf8'});assert.equal(first.status,0,'Explicit --env-file bootstrap must succeed');
  const result=JSON.parse(first.stdout);assert.equal(result.success,true);assert.equal(result.operator.email,'operator@example.test');assert(!first.stdout.includes(JSON.parse(input).password));
  const second=spawnSync(process.execPath,args,{env:childEnv,input,encoding:'utf8'});assert.notEqual(second.status,0,'Repeat bootstrap must refuse');
 }finally{await admin.query(`DROP DATABASE ${db} WITH (FORCE)`);await admin.end();}
 console.log(JSON.stringify({passed:5,checks:['fresh private config','distinct secrets','repeat preserves files','partial pair refusal','explicit env-file bootstrap and repeat refusal'],externalProviders:0}));
}finally{await fs.rm(temp,{recursive:true,force:true});}
