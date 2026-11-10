import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {TurtleGame} from '../turtle-game.js';
import {turtleQuestions} from '../turtle-questions.js';
import {defaults} from '../lib.js';
const game=new TurtleGame({random:()=>0});game.enter();game.start();game.ended(game.data.pendingSpeech.id);
game.ingest('小桃子','猜：他个子矮，够不到高层按钮');game.tick();const batch=game.takeBatch();game.apply(batch,{answers:[{id:batch.candidates[0].id,verdict:'部分正确',keys:['k1']}]});
const state={running:true,connection:'watching',songs:[],comments:[],logs:[],danceQueue:[],stats:{comments:0,replies:0,tokens:0,songs:0},drawGame:{phase:'off'},turtleGame:game.view()};
const clients=new Set(),root=path.resolve('public');let acknowledgements=0,ttsFail=true;const statuses=[];
const push=()=>{state.turtleGame=game.view();for(const res of clients)res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost'),json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
 if(u.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream'});res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return;}
 if(u.pathname==='/api/settings')return json({...defaults,speech:true});
 let body={};if(req.method==='POST'){let raw='';for await(const b of req)raw+=b;body=JSON.parse(raw||'{}');}
 if(u.pathname==='/api/tts'){if(ttsFail){res.statusCode=400;return json({error:'测试语音失败'});}res.setHeader('Content-Type','audio/mpeg');res.end(Buffer.from([1,2,3]));return;}
 if(u.pathname==='/api/speech-status'){statuses.push(body);return json({ok:true});}
 if(u.pathname==='/api/turtle-game/speech-ended'){const accepted=game.ended(body.id);if(accepted){acknowledgements++;push();}return json({accepted});}
 if(u.pathname==='/api/turtle-game/replay'){game.replay();push();return json({ok:true});}
 if(u.pathname.startsWith('/api/'))return json({ok:true});
 const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[],bounds=[];
try{
 const page=await browser.newPage({viewport:{width:1080,height:2400}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?stage=1&layout=portrait&silent=1');await page.locator('.turtle-game:not([hidden])').waitFor();await page.evaluate(async()=>{await document.fonts.ready;const img=new Image();img.src='/turtle-game-background.png';await img.decode();});
 for(const height of [2400,1920]){
  await page.setViewportSize({width:1080,height});await page.waitForTimeout(100);
  const b=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};return {scene:rect('.scene'),safe:rect('.turtle-safe'),story:rect('.turtle-surface'),current:rect('.turtle-current'),clues:rect('.turtle-clues'),instructions:rect('.turtle-instructions')};});
  assert.equal(b.scene.width,1080);assert.equal(b.scene.height,height);assert.equal(b.safe.height,height*.8);for(const key of ['story','current','clues','instructions']){assert.ok(b[key].bottom<=b.safe.bottom,key);assert.ok(b[key].right<=1080,key);}bounds.push(b);
  await page.locator('.turtle-instructions').waitFor({state:'visible'});assert.ok(b.instructions.height>0);assert.equal(await page.locator('.turtle-game').evaluate(n=>getComputedStyle(n).pointerEvents),'none');assert.equal(await page.locator('.roaming-cat').evaluate(n=>getComputedStyle(n).pointerEvents),'none');
  await page.screenshot({path:`output/turtle-game-1080x${height}.png`});
 }
 assert.equal(acknowledgements,0,'silent page cannot advance voice phases');
 const originalQuestion=game.data.questionId;
 for(const question of turtleQuestions){game.data.questionId=question.id;push();await page.waitForFunction(title=>document.querySelector('.turtle-surface h2').textContent===title,question.title);assert.ok(await page.locator('.turtle-surface').evaluate(n=>n.querySelector('p').getBoundingClientRect().bottom<=n.getBoundingClientRect().bottom-8),question.title+' fits story card');}
 game.data.questionId=originalQuestion;push();
 game.reveal();push();await page.locator('.turtle-reveal:not([hidden])').waitFor();assert.equal(await page.locator('.turtle-reveal p').textContent(),game.question.bottom);await page.screenshot({path:'output/turtle-game-reveal.png'});
 await page.reload();await page.locator('.turtle-reveal:not([hidden])').waitFor();assert.equal(acknowledgements,0);
 // The source's natural completion is simulated; TTS failure and stopped sources must not ACK.
 const audible=await browser.newPage({viewport:{width:1080,height:1920}});audible.on('pageerror',e=>errors.push(e.message));
 await audible.addInitScript(()=>{window.AudioContext=class{constructor(){this.state='running';this.destination={};}addEventListener(){}async resume(){this.state='running';}async decodeAudioData(){return {};}createBufferSource(){return {connect(){},start(){this.timer=setTimeout(()=>this.onended?.(),150);},stop(){clearTimeout(this.timer);}};}};});
 await audible.goto(base+'/?stage=1&layout=portrait');await audible.waitForTimeout(2500);assert.equal(acknowledgements,0,'failed synthesis does not advance');assert.equal(game.data.phase,'reveal');
 ttsFail=false;game.replay();push();for(let i=0;i<80&&acknowledgements<2;i++)await audible.waitForTimeout(100);
 assert.ok(acknowledgements>=2,'natural reveal and next intro complete');assert.equal(game.data.session,2);assert.equal(game.data.phase,'playing');assert.ok(statuses.some(s=>s.type==='speaking'));
 // Prove that an interrupted next narration produces no acknowledgement.
 ttsFail=true;game.reveal();push();await audible.waitForTimeout(300);const before=acknowledgements;await audible.reload();await audible.waitForTimeout(1500);assert.equal(acknowledgements,before);
 assert.deepEqual(errors,[]);await writeFile('output/turtle-ui-verification.json',JSON.stringify({bounds,errors,acknowledgements,checked:['9:20 and 9:16 fill','bottom 20% safe','cat pointer passthrough','silent and failed audio do not advance','natural audio completion','refresh restores revelation']},null,2));
 console.log('Turtle UI verified: layout, safe area, refresh, natural speech completion and failed/silent audio.');
}finally{await browser.close();for(const c of clients)c.end();await new Promise(r=>server.close(r));}
