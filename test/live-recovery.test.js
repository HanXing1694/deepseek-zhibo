import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
test('实际播报完成才处理后续回复；进程异常退出后自动恢复运行统计',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'whale-recovery-')),base='http://127.0.0.1:33229/api/';let child;
 const stop=async()=>{if(!child||child.exitCode!==null)return;const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;};
 t.after(async()=>{await stop();await rm(dir,{recursive:true,force:true});});
 const start=async()=>{
  child=spawn(process.execPath,['--import','./scripts/deepseek-fixture.mjs','server.js'],{env:{...process.env,PORT:'33229',WHALE_DATA_DIR:dir,DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error('test server exited '+code)));});
 };
 const call=async(route,data)=>{const response=await fetch(base+route,data===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});assert.equal(response.ok,true);return response.json();};
 const waitReply=async user=>{for(let i=0;i<60;i++){const state=await call('state');if(state.reply?.user===user)return state;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('reply not ready: '+user);};
 await start();await call('settings',{apiKey:'isolated-test-key',cooldown:1,autoReply:true,speech:true});await call('run',{running:true});
 await call('test-comment',{user:'第一位',text:'你好'});const first=await waitReply('第一位');
 await call('speech-status',{id:first.reply.id,type:'speaking'});
 await call('test-comment',{user:'第二位',text:'你好呀'});await new Promise(resolve=>setTimeout(resolve,1250));
 assert.equal((await call('state')).stats.replies,first.stats.replies);
 await call('speech-status',{id:first.reply.id,type:'ended'});const second=await waitReply('第二位');assert.equal(second.stats.replies,first.stats.replies+1);
 await call('speech-status',{id:second.reply.id,type:'ended'});
 await new Promise(resolve=>setTimeout(resolve,650));
 const stored=JSON.parse(await readFile(path.join(dir,'runtime-state.json'),'utf8'));assert.equal(stored.state.running,true);assert.equal(JSON.stringify(stored).includes('isolated-test-key'),false);
 await stop();await start();const restored=await call('state');assert.equal(restored.running,true);assert.equal(restored.stats.replies,second.stats.replies);assert.equal(restored.comments.length,2);
 await call('run',{running:false});
});
