// Isolated browser verification: synthetic silent WAV, no live API calls or audio.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(os.tmpdir(),'whale-ui-upgrade-'));
const child=spawn(process.execPath,['--import','./scripts/deepseek-fixture.mjs','server.js'],{env:{...process.env,PORT:'33239',WHALE_DATA_DIR:dir,DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error('isolated server exited '+code)));});
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
 const page=await browser.newPage({viewport:{width:1080,height:1920}}),errors=[],statuses=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.EventSource=class extends EventTarget{constructor(){super();window.__testEvents=this;}};});
 const bytes=Buffer.alloc(44+16000*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(16000,24);bytes.writeUInt32LE(32000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);
 await page.route('**/api/tts',route=>route.fulfill({status:200,contentType:'audio/wav',body:bytes}));
 await page.route('**/api/speech-status',async route=>{statuses.push({...route.request().postDataJSON(),time:Date.now()});await route.fulfill({json:{ok:true}});});
 await page.goto('http://127.0.0.1:33239/?stage=1&layout=portrait');
 await page.waitForFunction(()=>!!window.__testEvents);
 await page.evaluate(()=>window.__testEvents.dispatchEvent(new MessageEvent('state',{data:JSON.stringify({running:true,connection:'watching',connectionDetail:'等待真实弹幕',comments:[],songs:[],stats:{comments:0,replies:0,tokens:0,songs:0},logs:[],musicBackend:'desk',effect:null,danceQueue:[],collectorHealth:{status:'healthy',detail:'采集心跳正常'}})})));
 await page.waitForFunction(()=>document.querySelector('#voice-enable').textContent.includes('此窗口声音已启用'));
 const emit=reply=>page.evaluate(reply=>window.__testEvents.dispatchEvent(new MessageEvent('reply',{data:JSON.stringify(reply)})),reply);
 await emit({id:'one',kind:'chat',user:'第一位',question:'第一条',text:'第一条完整回复。',speech:true});
 await emit({id:'two',kind:'chat',user:'第二位',question:'第二条',text:'第二条完整回复。',speech:true});
 for(let i=0;i<80&&!statuses.some(s=>s.id==='two'&&s.type==='ended');i++)await page.waitForTimeout(100);
 const index=(id,type)=>statuses.findIndex(s=>s.id===id&&s.type===type);
 assert.ok(index('one','speaking')>=0);assert.ok(index('one','ended')>index('one','speaking'));
 assert.ok(index('two','pending')>index('one','ended'),'Second voice must not interrupt the first');
 assert.ok(index('two','ended')>index('two','speaking'));
 assert.match(await page.locator('#reply-question').textContent(),/第二位/);
 await mkdir('output',{recursive:true});await page.screenshot({path:'output/platform-upgrade-portrait.png'});
 await page.waitForTimeout(5200);assert.ok(await page.locator('.reply-card').evaluate(el=>el.hidden||el.classList.contains('reply-hidden')||getComputedStyle(el).opacity==='0'||document.querySelector('#scene').classList.contains('reply-panel-hidden')));
 assert.deepEqual(errors,[]);await writeFile('output/platform-upgrade-ui.json',JSON.stringify({passed:true,statuses,errors},null,2));
 console.log('UI passed: sequential real WebAudio completion, matching captions, 5-second close, sound enabled, no browser errors.');
}finally{
 await browser?.close();if(child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}await rm(dir,{recursive:true,force:true});
}
