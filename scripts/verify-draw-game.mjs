import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {defaults} from '../lib.js';
import {DrawAndGuess} from '../draw-and-guess.js';
import {DrawHost} from '../draw-host.js';
const game=new DrawAndGuess({random:()=>.999});game.enter();game.start();game.data.startedAt-=8000;game.guess('小桃子','雨伞');game.guess('阿星','雨伞');game.guess('奶茶','雨伞');
const state={connection:'watching',running:true,songs:[],comments:[],logs:[],danceQueue:[],stats:{comments:0,replies:0,tokens:0,songs:0},drawGame:game.view()};
const clients=new Set(),root=path.resolve('public');let ackCount=0,ttsFail=false;const spokenRequests=[];
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost'),json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
 if(url.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream'});res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return;}
 if(url.pathname==='/api/settings')return json({...defaults,speech:true});
 if(url.pathname==='/api/tts'){let body='';for await(const chunk of req)body+=chunk;spokenRequests.push(JSON.parse(body).text);if(ttsFail){res.statusCode=400;return json({error:'测试语音失败'});}res.setHeader('Content-Type','audio/mpeg');res.end(Buffer.from([1,2,3,4]));return;}
 if(url.pathname==='/api/draw-game/speech-ended'){ackCount++;return json({accepted:true});}
 if(url.pathname.startsWith('/api/'))return json({ok:true});
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const push=()=>{state.drawGame=game.view();for(const res of clients)res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);};
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1080,height:2400}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?stage=1&layout=portrait&silent=1');await page.locator('.scene.game-mode').waitFor();await page.locator('.draw-strokes path').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>getComputedStyle(document.querySelector('.draw-art')).backgroundImage.includes('draw-game-background'));
 await page.evaluate(async()=>{const img=new Image();img.src='/draw-game-background.png';await img.decode();});
 const bounds=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};return {scene:rect('.scene'),safe:rect('.draw-safe'),board:rect('.draw-board'),ranking:rect('.draw-ranking'),hint:rect('.draw-hint'),music:rect('.draw-music')};});
 assert.equal(bounds.scene.width,1080);assert.equal(bounds.scene.height,2400);assert.equal(bounds.safe.height,1920);for(const key of ['board','ranking','hint','music'])assert.ok(bounds[key].bottom<=bounds.safe.bottom,`${key} is above comment-safe area`);
 assert.equal(await page.locator('.draw-ranking > ol > li').count(),3);assert.equal(await page.locator('.draw-game').evaluate(el=>getComputedStyle(el).pointerEvents),'none');assert.equal(await page.locator('.draw-word-hint').textContent(),'答案是 2 个字');
 const strokes=()=>page.locator('.draw-strokes path').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('style')).join('|'));const before=await strokes();await page.waitForTimeout(300);assert.notEqual(await strokes(),before,'drawing progresses');
 game.data.startedAt=Date.now()-15000;push();
 await page.waitForFunction(()=>[...document.querySelectorAll('.draw-strokes path')].every(n=>Number(n.style.strokeDashoffset)===0));
 assert.equal(game.view().revealed,false,'full picture remains available during guessing');
 assert.equal(game.guess('完整图抢答','雨伞'),true,'guesses still score after the drawing finishes');
 await page.screenshot({path:'output/draw-game-faster-15s.png'});
 game.data.scores=game.data.scores.filter(s=>s.user!=='完整图抢答');
 game.data.winners=game.data.winners.filter(user=>user!=='完整图抢答');game.data.notice=null;push();
 await page.screenshot({path:'output/draw-game-1080x2400.png'});
 for(const size of [{width:1080,height:1920},{width:1440,height:2560}]){
  await page.setViewportSize(size);const fit=await page.locator('.scene').boundingBox();assert.equal(fit.x,0,'capture has no side bars');assert.equal(fit.y,0);assert.equal(fit.width,size.width);assert.equal(fit.height,size.height);
  assert.equal((await page.locator('.draw-safe').boundingBox()).height,size.height*.8,'bottom 20% stays clear');
  await page.screenshot({path:`output/draw-game-fill-${size.width}x${size.height}.png`});
 }
 await page.setViewportSize({width:1080,height:2400});
 await page.reload();await page.locator('.draw-ranking > ol > li').filter({hasText:'小桃子'}).waitFor();assert.equal(await page.locator('.draw-ranking > ol > li').count(),3);
 game.data.startedAt=Date.now()-25000;game.tick();push();await page.locator('.draw-word-hint.is-revealed').filter({hasText:'答案：雨伞'}).waitFor();assert.match(await page.locator('.draw-hint span').textContent(),/仍可 \+1分/);await page.screenshot({path:'output/draw-game-answer-reveal.png'});await page.reload();await page.locator('.draw-word-hint.is-revealed').filter({hasText:'答案：雨伞'}).waitFor();assert.equal(await page.locator('.draw-strokes path').evaluateAll(nodes=>nodes.every(n=>Number(n.style.strokeDashoffset)===0)),true,'drawing is complete before revealing the answer');
 const hosting=await browser.newPage();hosting.on('pageerror',e=>errors.push(e.message));
 await hosting.addInitScript(()=>{window.AudioContext=class{constructor(){this.state='running';this.destination={};}addEventListener(){}async resume(){}async decodeAudioData(){return {};}createBufferSource(){const source={connect(){},start(){source.timer=setTimeout(()=>source.onended?.(),3000);},stop(){clearTimeout(source.timer);}};return source;}};});
 game.data.startedAt=Date.now();push();await hosting.goto(base+'/?stage=1&layout=portrait');const host=new DrawHost();
 const hostCue=cue=>{state.reply=cue;push();for(const res of clients)res.write(`event: reply\ndata: ${JSON.stringify({...cue,speech:true,voiceRate:1.05})}\n\n`);};
 hostCue(host.observe(game.view())[0]);await hosting.waitForFunction(()=>document.querySelector('.scene').classList.contains('is-speaking'));assert.match(spokenRequests.at(-1),/开始啦/);
 game.data.startedAt=Date.now()-25000;push();await hosting.waitForFunction(()=>!document.querySelector('.scene').classList.contains('is-speaking'));assert.equal(ackCount,0,'cancelled host cue never acknowledges settlement');
 hostCue(host.observe(game.view())[0]);await hosting.waitForFunction(()=>document.querySelector('.scene').classList.contains('is-speaking'));assert.match(spokenRequests.at(-1),/答案是雨伞/);await hosting.waitForFunction(()=>!document.querySelector('.scene').classList.contains('is-speaking'));assert.equal(ackCount,0,'normal host speech never starts another session');await hosting.close();
 game.data.startedAt=Date.now()-180000;game.tick();state.reply={id:game.view().settlementId,text:game.celebration(),kind:'game',user:'大肥鱼',question:'本场结算'};push();await page.locator('.draw-overlay h2').filter({hasText:'本场精彩结算'}).waitFor();await page.screenshot({path:'output/draw-game-settlement.png'});assert.equal(ackCount,0,'silent output must not acknowledge speech');
 // Test browser playback callbacks with an owned deterministic Web Audio fake.
 const speaking=await browser.newPage({viewport:{width:540,height:1200}});speaking.on('pageerror',e=>errors.push(e.message));
 await speaking.addInitScript(()=>{window.AudioContext=class{constructor(){this.state='running';this.destination={};}addEventListener(){}async resume(){this.state='running';}async decodeAudioData(){return {};}createBufferSource(){const source={connect(){},start(){source.timer=setTimeout(()=>source.onended?.(),2000);},stop(){clearTimeout(source.timer);}};return source;}};});
 await speaking.goto(base+'/?stage=1&layout=portrait');await speaking.waitForFunction(()=>document.querySelector('.scene').classList.contains('is-speaking'));assert.equal(ackCount,0,'speech start is not completion');await speaking.waitForTimeout(2300);assert.equal(ackCount,1,'natural source.onended acknowledges completion');await speaking.close();
 ttsFail=true;ackCount=0;const failed=await browser.newPage();await failed.addInitScript(()=>{window.AudioContext=class{constructor(){this.state='running';}addEventListener(){}async resume(){} };});await failed.goto(base+'/?stage=1&layout=portrait');await failed.locator('#toast.visible').waitFor();await failed.waitForTimeout(400);assert.equal(ackCount,0,'TTS failure must not advance game');await failed.close();
 game.exit();push();await page.locator('.scene.game-mode').waitFor({state:'detached'});assert.equal(await page.locator('.draw-game').isVisible(),false);assert.equal((await page.locator('.scene').boundingBox()).height,1920);
 assert.deepEqual(errors,[]);await writeFile('output/draw-game-ui-verification.json',JSON.stringify({bounds,errors,checked:['9:20','bottom 20% clear','progressive drawing','answer character count','answer reveal at 25 seconds','revealed answer survives refresh','rank persistence on refresh','settlement','natural speech completion','silent and failed speech do not advance','return to radio']},null,2));console.log('Draw game UI verified: 1080×2400, answer length, 25-second reveal, refresh, settlement, speech callbacks and return.');
}finally{await browser.close();for(const res of clients)res.end();server.close();server.closeAllConnections();}
