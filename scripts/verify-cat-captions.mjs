import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(os.tmpdir(),'whale-cat-')),port=33414,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['--import','./scripts/deepseek-fixture.mjs','server.js'],{env:{...process.env,PORT:String(port),WHALE_DATA_DIR:dir,DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error(`server exited ${code}`)));});
 const call=async(route,data)=>{const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});assert.equal(response.ok,true);return response.json();};
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1280,height:1000}});
 // Two seconds of local PCM audio: verify actual AudioBufferSource ending without online TTS.
 const bytes=16000*2*2,wav=Buffer.alloc(44+bytes);wav.write('RIFF');wav.writeUInt32LE(36+bytes,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(bytes,40);
 await context.route('**/api/tts',route=>route.fulfill({contentType:'audio/wav',body:wav}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('.roaming-cat').waitFor();
 const cat=page.locator('.roaming-cat');const initial=await cat.evaluate(el=>getComputedStyle(el).transform);
 assert.equal(await cat.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 const stage=await context.newPage();await stage.setViewportSize({width:1280,height:720});await stage.goto(base+'/?stage=1&silent=1');await stage.locator('.roaming-cat').waitFor();
 await call('settings',{apiKey:'isolated-test',speech:true,cooldown:1});await call('run',{running:true});
 await page.bringToFront();if(!await page.locator('#voice-enable').evaluate(el=>el.classList.contains('enabled')))await page.locator('#voice-enable').click();await page.locator('#voice-enable.enabled').waitFor();
 await page.locator('#test-text').fill('测试五秒后收起文字面板');await page.locator('#test-send').click();
 try{await page.waitForFunction(()=>document.querySelector('#scene').classList.contains('is-speaking'),null,{timeout:6000});}catch(error){console.log('Audio diagnostic:',await page.evaluate(()=>({toast:document.querySelector('#toast').textContent,button:document.querySelector('#voice-enable').textContent,scene:document.querySelector('#scene').className,reply:document.querySelector('#reply-text').textContent})),errors);throw error;}
 assert.equal(await page.locator('.reply-card').isVisible(),true);assert.equal(await stage.locator('.reply-card').isVisible(),true);
 await page.waitForFunction(()=>!document.querySelector('#scene').classList.contains('is-speaking'));
 await page.waitForTimeout(4400);assert.equal(await page.locator('.reply-card').isVisible(),true);assert.equal(await stage.locator('.reply-card').isVisible(),true);
 await page.locator('.reply-card').waitFor({state:'hidden',timeout:2000});await stage.locator('.reply-card').waitFor({state:'hidden',timeout:2000});
 await page.waitForTimeout(5500);
 assert.notEqual(await cat.evaluate(el=>getComputedStyle(el).transform),initial);
 const area=await page.locator('#scene').boundingBox(),box=await cat.boundingBox();assert.ok(box.x>=area.x&&box.y>=area.y&&box.x+box.width<=area.x+area.width+1&&box.y+box.height<=area.y+area.height+1);
 await page.screenshot({path:'output/kitten-workspace.png',fullPage:true});await stage.screenshot({path:'output/kitten-stage.png'});
 await page.locator('body').evaluate(el=>el.classList.add('motion-paused'));await page.waitForTimeout(100);
 const frozen=await cat.evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(800);assert.equal(await cat.evaluate(el=>getComputedStyle(el).transform),frozen);
 await page.locator('body').evaluate(el=>el.classList.remove('motion-paused'));
 await call('settings',{speech:false});await call('test-comment',{user:'新观众',text:'面板重新打开'});await page.locator('.reply-card').waitFor({state:'visible'});
 await page.locator('.reply-card').waitFor({state:'hidden',timeout:6500});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('Verified: speech ends + five seconds, same-browser silent stage sync, new reply reopens, muted reply closes, kitten roams within whole scene, pointer passthrough, motion pause and mobile layout. No live-room actions.');
}finally{await browser?.close();const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;await rm(dir,{recursive:true,force:true});}
