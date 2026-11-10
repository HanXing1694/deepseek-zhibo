import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {catchphrases} from '../catchphrases.js';
test('明确在线0人仍自动触发口头禅；真实45秒起步并放缓、播报等待、无需模型消耗',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'whale-catchphrase-')),base='http://127.0.0.1:33249/api/';
 const child=spawn(process.execPath,['--import','./scripts/deepseek-fixture.mjs','server.js'],{env:{...process.env,PORT:'33249',WHALE_DATA_DIR:dir,WHALE_COLLECTOR_FIXTURE:'1',WHALE_AUDIENCE_FIXTURE:'0',DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;}await rm(dir,{recursive:true,force:true});});
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error('test server exited '+code)));});
 const call=async(route,data)=>{const response=await fetch(base+route,data===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});assert.equal(response.ok,true);return response.json();};
 const waitPhrase=async(previousId,timeout=49000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){const state=await call('state');if(state.reply?.catchphrase&&state.reply.id!==previousId)return state;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Adaptive catchphrase did not trigger');};
 await call('settings',{room:'1',apiKey:'isolated-key',idleChatter:true,idleChatterSeconds:15,autoReply:true,speech:true,cooldown:1});await call('connect',{});await call('run',{running:true});
 const started=Date.now(),first=await waitPhrase();assert.ok(Date.now()-started>=45000);assert.ok(catchphrases.includes(first.reply.text));assert.equal(first.stats.tokens,0);assert.equal(first.reply.tokens,0);assert.equal(first.stats.comments,0);assert.equal(first.audience.count,0);assert.equal(first.catchphraseStatus.audiencePresent,false);assert.notEqual(first.catchphraseStatus.waitingFor,'audience');
 await call('speech-status',{id:first.reply.id,type:'speaking'});await new Promise(resolve=>setTimeout(resolve,16000));assert.equal((await call('state')).reply.id,first.reply.id);
 const endedAt=Date.now();await call('speech-status',{id:first.reply.id,type:'ended'});
 // A delayed lower-stage callback cannot reopen an already completed voice lease.
 await call('speech-status',{id:first.reply.id,type:'pending'});const second=await waitPhrase(first.reply.id,94000);
 assert.ok(Date.now()-endedAt>=90000);assert.notEqual(second.reply.text,first.reply.text);assert.equal(second.stats.tokens,0);assert.ok(second.logs.some(log=>log.message.startsWith('口头禅已触发：')));
 await call('run',{running:false});await call('disconnect',{});
});
