import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {DrawAndGuess} from '../draw-and-guess.js';
import {LiveProgram} from '../live-program.js';
import {defaults} from '../lib.js';
const game=new DrawAndGuess({random:()=>.999});game.enter();game.start();game.guess('小桃子','雨伞');game.guess('阿星','雨伞');game.guess('奶茶','雨伞');
const program=new LiveProgram();program.enable(true);program.data.completed=2;
const top=[{user:'小桃子',score:28},{user:'阿星',score:21},{user:'奶茶',score:16}];
const state={running:true,connection:'watching',currentSong:{id:'playing',title:'晴天',artist:'周杰伦',position:42,duration:240,status:'正在播放'},songs:[{id:'queued',title:'江南',user:'听众'}],comments:[],logs:[],danceQueue:[],stats:{comments:0,replies:0,tokens:0,songs:0},drawGame:game.view(),turtleGame:{phase:'off'},program:program.view(),gameLeague:{day:'2026-11-05',top,ranking:top,metrics:{participants:12,songAfterDraw:4,crossStage:6,returnPlayers:5}}};
const clients=new Set(),root=path.resolve('public');let failTts=true,acks=0;
const push=()=>{state.drawGame=game.view();state.program=program.view();state.reply=program.data.pendingSpeech;for(const c of clients)c.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost'),json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
 if(u.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream'});res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return;}
 if(u.pathname==='/api/settings')return json({...defaults,speech:true});
 let body={};if(req.method==='POST'){let raw='';for await(const b of req)raw+=b;body=JSON.parse(raw||'{}');}
 if(u.pathname==='/api/tts'){if(failTts){res.statusCode=400;return json({error:'测试语音失败'});}res.setHeader('Content-Type','audio/mpeg');return res.end(Buffer.from([1,2,3]));}
 if(u.pathname==='/api/program/speech-ended'){const result=program.ended(body.id);if(result){acks++;if(result==='start-draw')game.start();push();}return json({accepted:!!result});}
 if(u.pathname.startsWith('/api/'))return json({ok:true});
 const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 try{res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],bounds=[];
try{
 const page=await browser.newPage({viewport:{width:1080,height:2400}});page.on('pageerror',e=>{errors.push(e.message);console.error('UI error: '+e.message);});await page.goto(base+'/?stage=1&layout=portrait&silent=1');await page.locator('.draw-league:not([hidden])').waitFor();await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(async()=>{const img=new Image();img.src='/draw-game-background.png';await img.decode();});
 for(const [width,height] of [[1080,2400],[1080,1920],[1440,2560]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(120);const b=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};return {safe:rect('.draw-safe'),league:rect('.draw-league'),banner:rect('.program-banner')};});assert.ok(b.league.height>0);assert.ok(b.league.bottom<b.safe.bottom);assert.ok(b.banner.bottom<b.safe.bottom);bounds.push(b);
  await page.locator('.program-banner').waitFor({state:'visible'});assert.match(await page.locator('.program-banner').textContent(),/3 \/ 5 场/);assert.equal(await page.locator('.draw-league li').count(),3);assert.equal(await page.locator('.program-scene').evaluate(n=>getComputedStyle(n).pointerEvents),'none');await page.locator('.program-commands').waitFor({state:'hidden'});assert.match(await page.locator('.program-banner').textContent(),/轮播已开启/);assert.match(await page.locator('.program-now strong').textContent(),/晴天.*周杰伦/);assert.match(await page.locator('.program-now span').textContent(),/江南/);await page.screenshot({path:`output/program-draw-${width}x${height}.png`});
 }
 await page.setViewportSize({width:1080,height:1920});
 state.gameLeague.query={user:'小桃子',text:'今日28分 · 第1名\n近30天：答对52题 · 参赛9场 · 最高10分',at:Date.now()};push();await page.locator('.program-query:not([hidden])').waitFor();await page.screenshot({path:'output/program-query.png'});
 game.exit();program.data.phase='music';program.data.musicElapsed=170000;state.currentSong={title:'晴天',artist:'周杰伦',position:42,duration:240,status:'正在播放'};state.gameLeague.query=null;push();await page.locator('.program-stars:not([hidden])').waitFor();await page.screenshot({path:'output/program-music-1080x1920.png'});assert.match(await page.locator('.program-banner').textContent(),/07:10/);
 await page.reload();await page.locator('.program-stars:not([hidden])').waitFor();assert.equal(await page.locator('.program-stars li').count(),3);await page.locator('.program-commands').waitFor({state:'hidden'});
 program.disable();push();await page.waitForFunction(()=>document.querySelector('.program-banner').textContent.includes('轮播未开启'));program.enable();push();await page.waitForFunction(()=>document.querySelector('.program-banner').textContent.includes('轮播已开启'));
 // A silent window and failed synthesis must never start the five-game block.
 program.data.phase='to-draw';game.enter();program.opening();push();await page.waitForTimeout(300);assert.equal(acks,0);
 const audible=await browser.newPage({viewport:{width:1080,height:1920}});audible.on('pageerror',e=>errors.push(e.message));await audible.addInitScript(()=>{window.AudioContext=class{constructor(){this.state='running';this.destination={};}addEventListener(){}async resume(){}async decodeAudioData(){return {};}createBufferSource(){return {connect(){},start(){this.timer=setTimeout(()=>this.onended?.(),200);},stop(){clearTimeout(this.timer);}};}};});
 await audible.goto(base+'/?stage=1&layout=portrait');await audible.waitForTimeout(2400);assert.equal(acks,0);assert.equal(game.data.phase,'ready');failTts=false;program.replay();push();for(let i=0;i<40&&!acks;i++)await audible.waitForTimeout(100);assert.equal(acks,1);assert.equal(game.data.phase,'drawing');assert.equal(program.data.gameTarget,5);
 assert.deepEqual(errors,[]);await writeFile('output/program-ui-verification.json',JSON.stringify({bounds,errors,acks,checked:['five-game progress','today leaderboard','music countdown and stars','query card','9:20 and 9:16 safe area','refresh','silent and failed audio do not start','natural audio starts next block']},null,2));console.log('Program UI verified: progress, daily scores, radio, query, refresh and natural audio.');
}finally{await browser.close();for(const c of clients)c.end();await new Promise(r=>server.close(r));}
