import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {defaults} from '../lib.js';
const fixture={connection:'watching',connectionDetail:'监听就绪',running:true,logs:[],songs:['晴天','七里香','稻香','夜曲','一路向北'].map((title,i)=>({id:String(i),title,user:'听众'+i})),failedSongs:[],danceQueue:[],comments:[],stats:{comments:0,replies:0,tokens:0,songs:0},currentSong:{id:'fixture',title:'夜曲',artist:'周杰伦',position:84,duration:226,status:'正在播放'}};
const clients=new Set(),root=path.resolve('public');
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream'});res.write(`event: state\ndata: ${JSON.stringify(fixture)}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return;}
 if(url.pathname==='/api/settings'||url.pathname==='/api/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(url.pathname==='/api/state'?fixture:defaults));return;}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1080,height:1920}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.clock.install();
 await page.goto(`http://127.0.0.1:${server.address().port}/?stage=1&layout=portrait&silent=1`);
 await page.locator('#song-title').filter({hasText:'夜曲'}).waitFor();
 await page.locator('.roaming-cat').waitFor();
 await page.locator('.attic-character.has-motion-canvas').waitFor();
 assert.equal(await page.locator('.attic-character').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 const headClip={x:410,y:670,width:330,height:320},sceneryClip={x:0,y:0,width:150,height:100};
 const headBefore=await page.screenshot({clip:headClip}),sceneryBefore=await page.screenshot({clip:sceneryClip});
 await page.clock.runFor(1000);
 assert.equal(headBefore.equals(await page.screenshot({clip:headClip})),false,'The character moves');
 assert.equal(sceneryBefore.equals(await page.screenshot({clip:sceneryClip})),true,'The scenery stays still');
 await page.locator('#scene').evaluate(el=>el.classList.add('is-speaking'));
 await page.clock.runFor(100);
 assert.equal(await page.locator('.attic-character').getAttribute('data-expression'),'speaking');
 await page.screenshot({path:'output/attic-character-speaking.png'});
 await page.locator('#scene').evaluate(el=>{el.classList.remove('is-speaking');el.classList.add('is-thinking');});
 await page.clock.runFor(100);
 assert.equal(await page.locator('.attic-character').getAttribute('data-expression'),'thinking');
 await page.locator('#scene').evaluate(el=>el.classList.remove('is-thinking'));
 await page.locator('#reply-text').evaluate(el=>el.textContent='欢迎来陪我加班呀！');
 await page.clock.runFor(100);
 assert.equal(await page.locator('.attic-character').getAttribute('data-expression'),'happy');
 await page.screenshot({path:'output/attic-character-happy.png'});
 await page.clock.runFor(4100);
 await page.evaluate(async()=>{const i=new Image();i.src='/attic-radio.jpg';await i.decode();});
 assert.equal(await page.locator('.attic-time').textContent(),'01:24 / 03:46');
 assert.equal(await page.locator('.attic-artist').count(),0,'The artist field is absent from the live radio');
 assert.equal((await page.locator('#scene').innerText()).includes('周杰伦'),false,'The live scene does not display artist metadata');
 assert.equal(await page.locator('#scene-queue li').count(),3);
 assert.equal(await page.locator('.attic-progress').getAttribute('aria-valuenow'),'37');
 assert.equal(await page.locator('.character-wrap').isVisible(),false);
 assert.equal(await page.locator('.roaming-cat').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 const bounds=await page.evaluate(()=>{const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return {scene:rect('#scene'),radio:rect('.attic-radio'),queue:rect('#scene-queue'),track:rect('.attic-track')};});
 assert.equal(bounds.scene.width,1080);assert.equal(bounds.scene.height,1920);
 await page.screenshot({path:'output/attic-radio-1080.png'});
 console.log(JSON.stringify(bounds));
 assert.ok(bounds.queue.right<bounds.radio.right&&bounds.queue.bottom<bounds.radio.bottom);
 await page.clock.runFor(2600);assert.equal(await page.locator('#scene-queue li').first().getAttribute('data-position'),'4');
 fixture.currentSong={title:'很长很长很长的歌名测试',artist:'测试歌手',position:0,duration:0,status:'暂停'};fixture.songs=[];
 for(const res of clients)res.write(`event: state\ndata: ${JSON.stringify(fixture)}\n\n`);
 await page.locator('#song-title').filter({hasText:'很长很长'}).waitFor();
 assert.equal(await page.locator('.attic-progress').getAttribute('aria-valuenow'),'0');
 assert.equal(await page.locator('.attic-radio.is-playing').count(),0);
 assert.equal(await page.locator('.portrait-queue-empty').count(),1);
 await page.setViewportSize({width:1440,height:2560});
 assert.equal(await page.locator('#scene').evaluate(el=>el.getBoundingClientRect().height),2560);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'output/attic-radio-phone.png'});
 await page.setViewportSize({width:1080,height:1920});
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
 const reply={id:'paper-answer',user:'海盐小鱼',question:'今天在忙什么？',text:'在认真写代码，也在等你来聊天呀。想听什么歌，告诉我就好！',speech:false,kind:'chat'};
 for(const res of clients)res.write(`event: reply\ndata: ${JSON.stringify(reply)}\n\n`);
 await page.locator('.attic-reply-paper #reply-text').filter({hasText:reply.text}).waitFor();
 assert.equal(await page.locator('#reply-question').textContent(),`${reply.user}：${reply.question}`);
 assert.equal(await page.locator('#reply-question').isVisible(),true);
 assert.equal(await page.locator('.attic-answer-label').textContent(),'肥鱼：');
 const dialogBounds=await page.evaluate(()=>{const question=document.querySelector('#reply-question').getBoundingClientRect(),answer=document.querySelector('.attic-answer-row').getBoundingClientRect();return {questionBottom:question.bottom,answerTop:answer.top};});
 assert.ok(dialogBounds.questionBottom<dialogBounds.answerTop,'The audience message appears above its answer');
 assert.equal(await page.locator('.reply-card').count(),1,'Only the desk paper carries the reply');
 const paperBounds=await page.locator('.attic-reply-paper').boundingBox();
 assert.ok(paperBounds.y<=1920*836/1280&&paperBounds.y+paperBounds.height>=1920*885/1280,'The replacement covers the original slogan');
 await page.screenshot({path:'output/attic-paper-reply.png'});
 await page.clock.runFor(4990);assert.equal(await page.locator('.reply-card').isVisible(),true);
 await page.clock.runFor(20);assert.equal(await page.locator('.reply-card').isVisible(),false);
 assert.equal(await page.locator('.attic-reply-paper').isVisible(),false,'The whole reply panel hides between conversations');
 assert.equal(await page.locator('.attic-desk-clear').isVisible(),true,'The old printed slogan stays covered with wood');
 await page.screenshot({path:'output/attic-paper-idle.png'});
 reply.id='paper-long-answer';reply.text='欢迎来陪我加班呀！'+ '这一首歌送给正在努力的你，忙碌的时候也记得好好休息。'.repeat(5);
 for(const res of clients)res.write(`event: reply\ndata: ${JSON.stringify(reply)}\n\n`);
 await page.locator('#reply-text').filter({hasText:reply.text}).waitFor();
 assert.equal(await page.locator('#reply-text').textContent(),reply.text);
 await page.screenshot({path:'output/attic-paper-long-reply.png'});
 assert.deepEqual(errors,[]);
 if(process.argv.includes('--record')){
  fixture.currentSong={id:'preview',title:'夜曲',artist:'周杰伦',position:84,duration:226,status:'正在播放'};
  fixture.songs=['晴天','七里香','稻香'].map((title,i)=>({id:String(i),title,user:'听众'}));
  const demo=await browser.newPage({viewport:{width:548,height:974}});
  await demo.goto(`http://127.0.0.1:${server.address().port}/?stage=1&layout=portrait&silent=1`);
  await demo.locator('.attic-character.has-motion-canvas').waitFor();
  await demo.evaluate(()=>{
   window.demoCanvas=document.createElement('canvas');demoCanvas.width=548;demoCanvas.height=974;
   window.demoStream=demoCanvas.captureStream(0);window.demoChunks=[];
   window.demoRecorder=new MediaRecorder(demoStream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:2400000});
   demoRecorder.ondataavailable=e=>demoChunks.push(e.data);demoRecorder.start();
  });
  for(let i=0;i<78;i++){
   if([24,40,54].includes(i))await demo.locator('#attic-expression-preview').evaluate(el=>el.click());
   const frame=await demo.screenshot({type:'jpeg',quality:85});
   await demo.evaluate(async base64=>{const image=new Image();image.src='data:image/jpeg;base64,'+base64;await image.decode();demoCanvas.getContext('2d').drawImage(image,0,0);demoStream.getVideoTracks()[0].requestFrame();},frame.toString('base64'));
   await demo.waitForTimeout(80);
  }
  const bytes=await demo.evaluate(async()=>{await new Promise(r=>{demoRecorder.onstop=r;demoRecorder.stop();});return Array.from(new Uint8Array(await new Blob(demoChunks,{type:'video/webm'}).arrayBuffer()));});
  await writeFile('output/attic-character-preview.webm',Buffer.from(bytes));await demo.close();
 }
 if(process.argv.includes('--live')){
  const before=await fetch('http://127.0.0.1:3210/api/state').then(r=>r.json());
  const live=await browser.newPage({viewport:{width:1080,height:1920}});
  live.on('pageerror',e=>errors.push(e.message));
  await live.goto('http://127.0.0.1:3210/?layout=portrait&stage=1&silent=1');
  await live.locator('#song-title').filter({hasText:before.currentSong.title}).waitFor();
  await live.evaluate(async()=>{const image=new Image();image.src='/attic-radio.jpg';await image.decode();});
  await live.screenshot({path:'output/attic-radio-live.png'});
  const after=await fetch('http://127.0.0.1:3210/api/state').then(r=>r.json());
  console.log(JSON.stringify({live:{running:after.running,connection:after.connection,detail:after.connectionDetail,title:after.currentSong?.title,queue:after.songs.length,comments:after.stats.comments,lastComment:after.comments.at(-1),lastLogs:after.logs.slice(-3)}}));
  assert.equal(before.running,after.running);assert.equal(before.currentSong.id,after.currentSong.id);assert.deepEqual(before.songs,after.songs);assert.deepEqual(errors,[]);
 }
 console.log(JSON.stringify({passed:true,bounds,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
